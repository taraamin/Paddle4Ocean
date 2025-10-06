import React, { useState, useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  View,
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { colors, spacing, typography } from "../theme";
import { db, storage } from "../firebaseConfig";
import {
  collection,
  doc,
  setDoc,
  Timestamp,
  updateDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import * as ImagePicker from "expo-image-picker";

const createDateCopyAtMidnight = (value) => {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const uriToBlob = async (uri) => {
  if (!uri) {
    throw new Error("Missing URI for upload");
  }

  if (Platform.OS === "web") {
    const webResponse = await fetch(uri);
    return await webResponse.blob();
  }

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function () {
      reject(new TypeError("Network request failed"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
};

const inferStorageMetadata = (asset) => {
  const fallbackExtension = "jpg";

  if (!asset) {
    return { extension: fallbackExtension, contentType: "image/jpeg" };
  }

  const fileNameExtension = asset.fileName?.split(".").pop();
  const mimeSubtype = asset.mimeType?.split("/").pop();
  const uriMatch = asset.uri?.match(/\.([a-zA-Z0-9]+)(\?|$)/);

  const extension = (fileNameExtension || mimeSubtype || uriMatch?.[1] || fallbackExtension)
    .toLowerCase();
  const normalizedExtension = extension === "jpeg" ? "jpg" : extension;

  const contentType = asset.mimeType
    ? asset.mimeType
    : normalizedExtension === "png"
    ? "image/png"
    : "image/jpeg";

  return { extension: normalizedExtension, contentType };
};

export default function UploadScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [location, setLocation] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [cleanupGoal, setCleanupGoal] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const clearFieldError = useCallback((field) => {
    setFormErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirm = (selectedDate) => {
    setDate(selectedDate || new Date());
    clearFieldError("date");
    hideDatePicker();
  };

  const pickImage = useCallback(async () => {
    const permissionResponse = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResponse.status !== "granted") {
      Alert.alert(
        "Permission needed",
        "We need access to your photo library so you can add a motivating cover image."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.7,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const pickedAsset = result.assets[0];
      setImage({
        uri: pickedAsset.uri,
        fileName: pickedAsset.fileName || `trip-cover-${Date.now()}.jpg`,
        mimeType: pickedAsset.mimeType || (pickedAsset.type === "image" ? "image/jpeg" : undefined),
        width: pickedAsset.width,
        height: pickedAsset.height,
      });
      clearFieldError("image");
    }
  }, [clearFieldError]);

  const validateForm = useCallback(() => {
    const nextErrors = {};
    if (!title.trim()) {
      nextErrors.title = "Please add a descriptive trip title.";
    }
    if (!location.trim()) {
      nextErrors.location = "Let volunteers know where to meet.";
    }
    if (!maxParticipants.trim()) {
      nextErrors.maxParticipants = "Tell us how many paddlers you can host.";
    }
    const parsedMax = parseInt(maxParticipants, 10);
    if (maxParticipants.trim() && (Number.isNaN(parsedMax) || parsedMax <= 0)) {
      nextErrors.maxParticipants = "Use a positive number for max participants.";
    }
    if (!cleanupGoal.trim()) {
      nextErrors.cleanupGoal = "Share a cleanup goal so people know the mission.";
    }
    if (!organizer.trim()) {
      nextErrors.organizer = "Add organizer contact details.";
    }

    const todayMidnight = createDateCopyAtMidnight(new Date());
    const chosenMidnight = createDateCopyAtMidnight(date);
    if (chosenMidnight < todayMidnight) {
      nextErrors.date = "Pick a date that is today or later.";
    }

    if (!image?.uri) {
      nextErrors.image = "A cover photo helps volunteers spot your trip.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [title, location, maxParticipants, cleanupGoal, organizer, date, image]);

  const uploadCoverImage = useCallback(async (asset, tripId) => {
    if (!asset?.uri) {
      return "";
    }

    const { extension, contentType } = inferStorageMetadata(asset);
    const blob = await uriToBlob(asset.uri);
    try {
      const imageRef = ref(storage, `tripImages/${tripId}.${extension}`);
      await uploadBytes(imageRef, blob, { contentType });
      const downloadUrl = await getDownloadURL(imageRef);
      return downloadUrl;
    } finally {
      blob.close?.();
    }
  }, []);

  const handleUpload = async () => {
    if (!validateForm()) {
      return;
    }

    const maxPart = parseInt(maxParticipants, 10);
    setLoading(true);

    const tripsCollection = collection(db, "paddleTrips");
    const newTripRef = doc(tripsCollection);
    const baseTrip = {
      title: title.trim(),
      date: Timestamp.fromDate(date),
      location: location.trim(),
      maxParticipants: maxPart,
      cleanupGoal: cleanupGoal.trim(),
      organizer: organizer.trim(),
      image: "",
      status: "upcoming",
      participants: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    let tripCreated = false;

    try {
      await setDoc(newTripRef, baseTrip);
      tripCreated = true;

      if (image?.uri) {
        const downloadUrl = await uploadCoverImage(image, newTripRef.id);
        if (downloadUrl) {
          await updateDoc(newTripRef, {
            image: downloadUrl,
            updatedAt: serverTimestamp(),
          });
        }
      }

      Alert.alert("Success", "Trip uploaded successfully!");

      setTitle("");
      setDate(new Date());
      setLocation("");
      setMaxParticipants("");
      setCleanupGoal("");
      setOrganizer("");
      setImage(null);
      setFormErrors({});
      navigation.navigate("Overview");
    } catch (error) {
      console.error("Error uploading trip: ", error);
      if (tripCreated) {
        await deleteDoc(newTripRef).catch(() => {});
      }
      Alert.alert(
        "Upload Failed",
        "We couldn't publish your trip right now. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = date ? date.toLocaleDateString() : "Select a date";
  const webDateValue = date ? date.toISOString().slice(0, 10) : "";
  const isSubmitDisabled = loading;
  const previewUri = image?.uri ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <Text style={styles.header}>Create a New Trip</Text>
          <Text style={styles.subHeader}>
            Share the essentials so paddlers can join and help clean the coastline.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Trip Title</Text>
            <TextInput
              style={[styles.input, formErrors.title && styles.inputError]}
              placeholder="Morning harbor cleanup"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                clearFieldError("title");
              }}
              autoCapitalize="sentences"
            />
            {formErrors.title ? (
              <Text style={styles.errorText}>{formErrors.title}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={webDateValue}
                onChange={(event) => {
                  setDate(new Date(event.target.value));
                  clearFieldError("date");
                }}
                style={StyleSheet.flatten([
                  styles.webDateInput,
                  formErrors.date && styles.webDateInputError,
                ])}
              />
            ) : (
              <TouchableOpacity
                style={[styles.datePickerButton, formErrors.date && styles.inputError]}
                onPress={showDatePicker}
              >
                <Text style={styles.datePickerText}>{formattedDate}</Text>
              </TouchableOpacity>
            )}
            <DateTimePickerModal
              isVisible={isDatePickerVisible}
              mode="date"
              onConfirm={handleConfirm}
              onCancel={hideDatePicker}
              minimumDate={new Date()}
            />
            {formErrors.date ? (
              <Text style={styles.errorText}>{formErrors.date}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={[styles.input, formErrors.location && styles.inputError]}
              placeholder="City marina, dock B"
              value={location}
              onChangeText={(value) => {
                setLocation(value);
                clearFieldError("location");
              }}
            />
            {formErrors.location ? (
              <Text style={styles.errorText}>{formErrors.location}</Text>
            ) : null}
          </View>

          <View style={styles.halfRow}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Max Participants</Text>
              <TextInput
                style={[styles.input, formErrors.maxParticipants && styles.inputError]}
                placeholder="10"
                value={maxParticipants}
                onChangeText={(value) => {
                  setMaxParticipants(value);
                  clearFieldError("maxParticipants");
                }}
                keyboardType="numeric"
              />
              {formErrors.maxParticipants ? (
                <Text style={styles.errorText}>{formErrors.maxParticipants}</Text>
              ) : null}
            </View>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Cleanup Goal</Text>
              <TextInput
                style={[styles.input, formErrors.cleanupGoal && styles.inputError]}
                placeholder="Collect 8 bags of plastic"
                value={cleanupGoal}
                onChangeText={(value) => {
                  setCleanupGoal(value);
                  clearFieldError("cleanupGoal");
                }}
              />
              {formErrors.cleanupGoal ? (
                <Text style={styles.errorText}>{formErrors.cleanupGoal}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Organizer Contact</Text>
            <TextInput
              style={[styles.input, formErrors.organizer && styles.inputError]}
              placeholder="Jane Doe · +47 900 00 000"
              value={organizer}
              onChangeText={(value) => {
                setOrganizer(value);
                clearFieldError("organizer");
              }}
              autoCapitalize="words"
            />
            {formErrors.organizer ? (
              <Text style={styles.errorText}>{formErrors.organizer}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Cover Image</Text>
            <TouchableOpacity
              style={[styles.imagePickerButton, formErrors.image && styles.imagePickerButtonError]}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              <Text style={styles.imagePickerButtonText}>
                {image ? "Change cover image" : "Add a cover image"}
              </Text>
              <Text style={styles.imagePickerHint}>Square photos display best</Text>
            </TouchableOpacity>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.previewImage} />
            ) : null}
            {formErrors.image ? (
              <Text style={styles.errorText}>{formErrors.image}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.uploadButton, isSubmitDisabled && styles.uploadButtonDisabled]}
            onPress={handleUpload}
            disabled={isSubmitDisabled}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>Publish Trip</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  header: {
    fontSize: typography.heading,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  subHeader: {
    fontSize: typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.4,
  },
  input: {
    width: "100%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.body,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
  },
  errorText: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: typography.caption,
  },
  datePickerButton: {
    width: "100%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  datePickerText: {
    fontSize: typography.body,
    color: colors.textPrimary,
  },
  webDateInput: {
    width: "100%",
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.body,
  },
  webDateInputError: {
    borderColor: colors.danger,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
  },
  halfRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  imagePickerButton: {
    borderWidth: 1,
    borderColor: colors.highlight,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(27, 161, 242, 0.15)",
  },
  imagePickerButtonError: {
    borderColor: colors.danger,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
  },
  imagePickerButtonText: {
    color: colors.highlight,
    fontSize: typography.body,
    fontWeight: "600",
  },
  imagePickerHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    marginTop: spacing.sm,
  },
  uploadButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.highlight,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    alignItems: "center",
  },
  uploadButtonDisabled: {
    backgroundColor: colors.border,
  },
  uploadButtonText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: "700",
  },
});


