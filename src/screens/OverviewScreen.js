import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  SafeAreaView,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { colors, spacing, typography } from "../theme";
import { auth, db } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
const filters = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Completed", value: "completed" },
  { label: "All Trips", value: "all" },
];

const formatTripDate = (dateValue) => {
  if (!dateValue) {
    return "Date to be announced";
  }

  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate().toLocaleString();
  }

  if (typeof dateValue === "string") {
    return dateValue;
  }

  try {
    return new Date(dateValue).toLocaleString();
  } catch (error) {
    return "Date to be announced";
  }
};

export default function OverviewScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("upcoming");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      console.error("Error signing out: ", error);
      Alert.alert("Sign out failed", "Please try again.");
    }
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleSignOut}
          style={styles.signOutButton}
        >
          <Text style={styles.signOutButtonText}>Log out</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("Upload")}
          style={styles.newTripButton}
        >
          <Text style={styles.newTripButtonText}>New Trip</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSignOut]);

  const tripsCollection = useMemo(() => collection(db, "paddleTrips"), []);
  const tripsQuery = useMemo(
    () => query(tripsCollection, orderBy("date", "asc")),
    [tripsCollection]
  );

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      tripsQuery,
      (snapshot) => {
        const tripList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTrips(tripList);
        setIsLoading(false);
        setErrorMessage("");
      },
      (error) => {
        console.error("Error fetching trips: ", error);
        setIsLoading(false);
        setErrorMessage(
          "We couldn't load trips right now. Pull to refresh to try again."
        );
      }
    );

    return () => unsubscribe();
  }, [tripsQuery]);

  const refreshTrips = useCallback(async () => {
    setRefreshing(true);
    try {
      const snapshot = await getDocs(tripsQuery);
      const tripList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTrips(tripList);
      setErrorMessage("");
    } catch (error) {
      console.error("Error refreshing trips: ", error);
      setErrorMessage("Unable to refresh trips right now. Please try again later.");
    } finally {
      setRefreshing(false);
    }
  }, [tripsQuery]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filteredTrips = useMemo(() => {
    const normalizedFilter = selectedFilter;
    const queryTerm = debouncedQuery;

    return trips.filter((trip) => {
      const status = (trip.status || "upcoming").toLowerCase();
      if (normalizedFilter !== "all" && status !== normalizedFilter) {
        return false;
      }

      if (queryTerm) {
        const titleMatch = (trip.title || "").toLowerCase().includes(queryTerm);
        const locationMatch = (trip.location || "").toLowerCase().includes(queryTerm);
        if (!titleMatch && !locationMatch) {
          return false;
        }
      }

      return true;
    });
  }, [trips, selectedFilter, debouncedQuery]);

  const renderTrip = useCallback(
    ({ item }) => {
      const status = (item.status || "upcoming").toLowerCase();
      const participantsCount = Array.isArray(item.participants)
        ? item.participants.length
        : 0;
      const maxParticipants = item.maxParticipants || 0;
      const hasCapacityLimit = maxParticipants > 0;
      const availableSlots = hasCapacityLimit
        ? Math.max(0, maxParticipants - participantsCount)
        : null;
      const statusStyles = [styles.statusPill];

      if (status === "upcoming") {
        statusStyles.push(styles.statusPillUpcoming);
      } else if (status === "completed") {
        statusStyles.push(styles.statusPillCompleted);
      }

      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      const capacityLabel = hasCapacityLimit ? `${participantsCount}/${maxParticipants}` : `${participantsCount}`;

      return (
        <TouchableOpacity
          style={styles.tripCard}
          onPress={() => navigation.navigate("Detail", { trip: item })}
        >
          <Image
            source={
              item.image
                ? { uri: item.image }
                : require("../../src/assets/Paddle.jpg")
            }
            style={styles.tripImage}
          />
          <View style={styles.tripContent}>
            <View style={styles.tripHeaderRow}>
              <Text style={styles.tripTitle}>{item.title || "Untitled trip"}</Text>
              <View style={styles.participantBadge}>
                <Text style={styles.participantBadgeText}>{capacityLabel}</Text>
              </View>
            </View>
            <Text style={styles.tripMeta}>
              {item.location || "Location to be announced"}
            </Text>
            <Text style={styles.tripMeta}>{formatTripDate(item.date)}</Text>
            <Text style={styles.tripMeta}>
              Cleanup goal: {item.cleanupGoal || "Set during briefing"}
            </Text>
            {item.organizer ? (
              <Text style={styles.tripMeta}>Organizer: {item.organizer}</Text>
            ) : null}
            <View style={styles.tripFooter}>
              <View style={statusStyles}>
                <Text style={styles.statusText}>{statusLabel}</Text>
              </View>
              {availableSlots === null ? (
                <Text style={styles.availabilityText}>Open capacity</Text>
              ) : (
                <Text
                  style={[
                    styles.availabilityText,
                    availableSlots === 0 && styles.availabilityTextFull,
                  ]}
                >
                  {availableSlots === 0
                    ? "Fully booked"
                    : `${availableSlots} spot${availableSlots === 1 ? "" : "s"} left`}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        refreshing={refreshing}
        onRefresh={refreshTrips}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <Text style={styles.headerText}>Paddle Cleanup Trips</Text>
            <View style={styles.filterContainer}>
              {filters.map((filter) => {
                const isSelected = selectedFilter === filter.value;
                return (
                  <TouchableOpacity
                    key={filter.value}
                    style={[
                      styles.filterButton,
                      isSelected && styles.filterButtonSelected,
                    ]}
                    onPress={() => setSelectedFilter(filter.value)}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        isSelected && styles.filterButtonTextSelected,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search trips by title or location"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              placeholderTextColor={colors.textMuted}
            />
            {errorMessage ? (
              <View style={styles.feedbackBanner}>
                <Text style={styles.feedbackText}>{errorMessage}</Text>
              </View>
            ) : null}
            {isLoading ? (
              <View style={styles.stateWrapper}>
                <ActivityIndicator color={colors.highlight} />
                <Text style={styles.stateText}>Loading trips...</Text>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={() =>
          isLoading ? null : (
            <View style={styles.stateWrapper}>
              <Text style={styles.stateText}>
                No trips match your filters yet. Adjust your search or create a new trip.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  listHeader: {
    marginBottom: spacing.md,
  },
  headerText: {
    fontSize: typography.heading,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.highlight,
    backgroundColor: "transparent",
  },
  filterButtonSelected: {
    backgroundColor: colors.highlight,
    shadowColor: colors.highlight,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  filterButtonText: {
    fontSize: typography.caption,
    color: colors.highlight,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  filterButtonTextSelected: {
    color: colors.textPrimary,
  },
  newTripButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginRight: spacing.md,
  },
  newTripButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: "700",
  },
  signOutButton: {
    marginLeft: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "transparent",
  },
  signOutButtonText: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  searchInput: {
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
  feedbackBanner: {
    backgroundColor: colors.cardMuted,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  feedbackText: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    textAlign: "center",
  },
  stateWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  stateText: {
    marginTop: spacing.sm,
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  tripCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  tripImage: {
    width: "100%",
    height: 190,
  },
  tripContent: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tripHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  tripTitle: {
    fontSize: typography.subheading,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  participantBadge: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  participantBadgeText: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tripMeta: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  tripFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  statusPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  statusPillUpcoming: {
    backgroundColor: colors.highlight,
  },
  statusPillCompleted: {
    backgroundColor: colors.success,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: "600",
  },
  availabilityText: {
    fontSize: typography.caption,
    color: colors.highlightMuted,
    fontWeight: "600",
  },
  availabilityTextFull: {
    color: colors.danger,
  },
});








