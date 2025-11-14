import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MiniPayProvider } from "./src/providers/MiniPayProvider";
import PredictionScreen from "./src/screens/PredictionScreen";

const queryClient = new QueryClient();

export default function App() {
  return (
    <MiniPayProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <PredictionScreen />
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </QueryClientProvider>
    </MiniPayProvider>
  );
}

