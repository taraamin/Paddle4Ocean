import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { colors, spacing, typography } from "../theme";
import { auth, db } from "../firebaseConfig";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
const formatDateTime = (timestamp) => {
  if (!timestamp) {
    return "To be announced";
  }

  if (typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleString();
  }

  if (typeof timestamp === "string") {
    return timestamp;
  }

  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return "To be announced";
  }
};

export default function DetailScreen({ route, navigation }) {
  const { trip } = route.params;
  const [tripDetails, setTripDetails] = useState(trip);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  const participants = useMemo(() => {
    if (Array.isArray(tripDetails.participants)) {
      return tripDetails.participants;
    }
    return [];
  }, [tripDetails.participants]);

  const maxParticipants = Number(tripDetails.maxParticipants) || 0;
  const hasCapacityLimit = maxParticipants > 0;
  const participantsCount = participants.length;
  const availableSlots = hasCapacityLimit
    ? Math.max(0, maxParticipants - participantsCount)
    : null;
  const isTripFull = hasCapacityLimit && availableSlots === 0;

  const userId = currentUser?.uid ?? null;
  const isUserSignedUp = userId ? participants.includes(userId) : false;
  const signUpDisabled = !isUserSignedUp && isTripFull;

  const status = (tripDetails.status || "upcoming").toLowerCase();
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const ensureAuthenticated = useCallback(() => {
    if (currentUser) {
      return true;
    }

    Alert.alert(
      "Login required",
      "Log in or create an account to join, manage, or complete this trip.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Go to login",
          onPress: () => navigation.navigate("Login"),
        },
      ]
    );
    return false;
  }, [currentUser, navigation]);

  const refreshTrip = useCallback(async () => {
    const tripDocRef = doc(db, "paddleTrips", tripDetails.id);
    const updatedTripSnap = await getDoc(tripDocRef);
    setTripDetails({ id: updatedTripSnap.id, ...updatedTripSnap.data() });
  }, [tripDetails.id]);

  const handleSignUp = async () => {
    if (!ensureAuthenticated()) {
      return;
    }
    if (isUserSignedUp) {
      Alert.alert("Info", "You are already on the list for this trip.");
      return;
    }
    if (isTripFull) {
      Alert.alert("Info", "All available spots are taken.");
      return;
    }

    setIsProcessing(true);
    try {
      const tripDocRef = doc(db, "paddleTrips", tripDetails.id);
      await updateDoc(tripDocRef, {
        participants: arrayUnion(userId),
      });
      await refreshTrip();
      Alert.alert("Success", "You are in! See you on the water.");
    } catch (error) {
      console.error("Error signing up: ", error);
      Alert.alert("Error", "We could not add you to the trip. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSignUp = async () => {
    if (!ensureAuthenticated()) {
      return;
    }
    if (!isUserSignedUp) {
      Alert.alert("Info", "You are not currently signed up for this trip.");
      return;
    }

    setIsProcessing(true);
    try {
      const tripDocRef = doc(db, "paddleTrips", tripDetails.id);
      await updateDoc(tripDocRef, {
        participants: arrayRemove(userId),
      });
      await refreshTrip();
      Alert.alert("Success", "You have been removed from the attendee list.");
    } catch (error) {
      console.error("Error canceling sign up: ", error);
      Alert.alert("Error", "We could not update your sign-up. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const markTripAsCompleted = async () => {
    if (!ensureAuthenticated()) {
      return;
    }
    if (tripDetails.status === "completed") {
      Alert.alert("Info", "This trip is already marked as complete.");
      return;
    }
    if (!isUserSignedUp) {
      Alert.alert("Info", "Only participants can mark the trip as completed.");
      return;
    }

    setIsProcessing(true);
    try {
      const tripDocRef = doc(db, "paddleTrips", tripDetails.id);
      await updateDoc(tripDocRef, {
        status: "completed",
        completionNote: "Thank you for helping clean the ocean!",
      });
      await refreshTrip();
      Alert.alert("Success", "Trip marked as completed.");
    } catch (error) {
      console.error("Error updating trip status: ", error);
      Alert.alert("Error", "We could not update the trip. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image
          source={
            tripDetails.image
              ? { uri: tripDetails.image }
              : require("../../src/assets/Paddle.jpg")
          }
          style={styles.heroImage}
        />

        <View style={styles.headerRow}>
          <Text style={styles.title}>{tripDetails.title || "Paddle cleanup"}</Text>
          <View
            style={[
              styles.statusPill,
              status === "completed" ? styles.statusCompleted : styles.statusUpcoming,
            ]}
          >
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{tripDetails.location || "To be announced"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date & Time</Text>
            <Text style={styles.infoValue}>{formatDateTime(tripDetails.date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Organizer</Text>
            <Text style={styles.infoValue}>{tripDetails.organizer || "Unknown"}</Text>
          </View>
        </View>

        <View style={styles.capacityCard}>
          <Text style={styles.capacityTitle}>Attendance</Text>
          <Text style={styles.capacityCount}>
            {participantsCount}
            {hasCapacityLimit ? ` / ${maxParticipants}` : ""}
          </Text>
          <Text
            style={[
              styles.capacityHint,
              isTripFull && styles.capacityHintFull,
            ]}
          >
            {availableSlots === null
              ? "Unlimited spots available"
              : availableSlots === 0
              ? "Fully booked"
              : `${availableSlots} spot${availableSlots === 1 ? "" : "s"} left`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cleanup Goal</Text>
          <Text style={styles.sectionBody}>
            {tripDetails.cleanupGoal || "The organizer will share the goal on site."}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          {participantsCount > 0 ? (
            <View style={styles.participantGrid}>
              {participants.map((uid, index) => (
                <View key={uid || index} style={styles.participantChip}>
                  <Text style={styles.participantChipText}>{uid}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionMuted}>No participants yet. Be the first to join!</Text>
          )}
        </View>

        {tripDetails.status === "completed" && tripDetails.completionNote ? (
          <View style={styles.noticeCardGreen}>
            <Text style={styles.noticeTitle}>Mission complete</Text>
            <Text style={styles.noticeText}>{tripDetails.completionNote}</Text>
          </View>
        ) : null}

        {!currentUser ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Want to take part?</Text>
            <Text style={styles.noticeText}>
              Log in to reserve a spot and receive reminders before the paddle.
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.loginButton]}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.actionButtonText}>Go to login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionsSection}>
            {tripDetails.status !== "completed" ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isUserSignedUp ? styles.cancelButton : styles.joinButton,
                  (signUpDisabled || isProcessing) && styles.actionButtonDisabled,
                ]}
                onPress={isUserSignedUp ? handleCancelSignUp : handleSignUp}
                disabled={signUpDisabled || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {isUserSignedUp
                      ? "Cancel my spot"
                      : isTripFull
                      ? "Trip full"
                      : "Join this trip"}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>This trip is completed</Text>
                <Text style={styles.noticeText}>
                  Thank you to everyone who helped clean the shoreline.
                </Text>
              </View>
            )}

            {isUserSignedUp && tripDetails.status !== "completed" ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={markTripAsCompleted}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Mark as completed</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heroImage: {
    width: "100%",
    height: 240,
    borderRadius: 22,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  statusUpcoming: {
    backgroundColor: colors.highlight,
  },
  statusCompleted: {
    backgroundColor: colors.success,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  capacityCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  capacityTitle: {
    fontSize: typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  capacityCount: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  capacityHint: {
    marginTop: spacing.xs,
    fontSize: typography.body,
    color: colors.highlightMuted,
  },
  capacityHintFull: {
    color: colors.danger,
    fontWeight: "600",
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sectionBody: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sectionMuted: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  participantGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  participantChip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  participantChipText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  noticeCard: {
    backgroundColor: colors.cardMuted,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noticeCardGreen: {
    backgroundColor: "rgba(46, 213, 115, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noticeTitle: {
    fontSize: typography.subheading,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  noticeText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actionsSection: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButton: {
    borderRadius: 14,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  joinButton: {
    backgroundColor: colors.highlight,
  },
  cancelButton: {
    backgroundColor: colors.danger,
  },
  completeButton: {
    backgroundColor: colors.success,
  },
  loginButton: {
    backgroundColor: colors.accent,
  },
  actionButtonDisabled: {
    backgroundColor: colors.border,
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: "600",
  },
});






