import React, { useEffect } from "react";
import { Platform } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import LoginScreen from "./src/screens/LoginScreen";
import OverviewScreen from "./src/screens/OverviewScreen";
import DetailScreen from "./src/screens/DetailScreen";
import UploadScreen from "./src/screens/UploadScreen";
import { colors } from "./src/theme";

const Stack = createStackNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.highlight,
    text: colors.textPrimary,
    border: colors.border,
  },
};

export default function App() {
  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.style.height = "100%";
      document.body.style.height = "100%";
      document.body.style.overflowY = "auto";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
    }
  }, []);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: "700", letterSpacing: 0.4 },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Overview" component={OverviewScreen} />
        <Stack.Screen name="Detail" component={DetailScreen} />
        <Stack.Screen name="Upload" component={UploadScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
