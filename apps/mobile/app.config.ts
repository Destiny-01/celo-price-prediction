import "dotenv/config";

const scheme = process.env.EXPO_PUBLIC_SCHEME ?? "minipay-prediction";
const predictionNetwork =
  process.env.EXPO_PUBLIC_PREDICTION_NETWORK ?? "sepolia";

export default () => ({
  expo: {
    name: "MiniPay Prediction",
    slug: "minipay-prediction",
    version: "1.0.0",
    orientation: "portrait",
    scheme,
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    web: {
      bundler: "metro",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.diac.minipay",
    },
    android: {
      package: "com.diac.minipay",
    },
    extra: {
      predictionNetwork,
      eas: {
        // Path used in Metro config to read shared contract metadata
        predictionConfigPath: "../../config/prediction-addresses.json",
      },
    },
    plugins: [],
  },
});
