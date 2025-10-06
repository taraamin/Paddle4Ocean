import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { auth } from "../firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { colors, spacing, typography } from "../theme";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

    const handleLogin = async () => {
    if (!email.includes("@") || password.length < 6) {
      Alert.alert(
        "Hold on",
        "Add a valid email and a password with at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      setRegistrationMessage("");
      setErrorMessage("");
      setEmail("");
      setPassword("");
      navigation.replace("Overview");
    } catch (error) {
      console.error("Login Error:", error.code, error.message);
      setErrorMessage("We couldn't sign you in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

    const handleRegister = async () => {
    if (!email.includes("@") || password.length < 6) {
      Alert.alert(
        "Almost there",
        "Use a valid email and pick a password over 6 characters."
      );
      return;
    }

    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email, password);
      setRegistrationMessage(
        "Account created! Sign in with your new credentials to join the cleanups."
      );
      setErrorMessage("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Registration Error:", error.code, error.message);
      const friendlyMessage =
        error?.code === "auth/email-already-in-use"
          ? "That email already has an account. Sign in instead or use another address."
          : "We couldn't register that account. Double-check your details and try again.";
      setErrorMessage(friendlyMessage);
      setRegistrationMessage("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.heading}>Paddle for Ocean</Text>
            <Text style={styles.subheading}>
              Rally paddlers, track cleanups, and celebrate cleaner coastlines.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                placeholder="Minimum 6 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
            </View>

            {errorMessage ? (
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            ) : null}

            {registrationMessage ? (
              <Text style={styles.successMessage}>{registrationMessage}</Text>
            ) : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Sign in</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleRegister}
                disabled={loading}
              >
                <Text style={styles.buttonText}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subheading: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  inputGroup: { marginBottom: spacing.md },
  label: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontSize: typography.caption,
    letterSpacing: 0.4,
  },
  input: {
    width: "100%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.body,
  },
  buttonRow: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButton: { backgroundColor: colors.highlight },
  secondaryButton: { backgroundColor: colors.cardMuted },
  buttonText: {
    fontSize: typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  successMessage: {
    marginTop: spacing.sm,
    color: colors.success,
    fontSize: typography.body,
  },
  errorMessage: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: typography.body,
  },
});

