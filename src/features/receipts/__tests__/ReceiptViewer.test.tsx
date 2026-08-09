import { render, screen } from "@testing-library/react-native";
import { ReceiptViewer } from "../ReceiptViewer";

// react-native-webview pulls in a native module that jest-expo can't
// resolve; the only thing this test needs from it is a mockable, inspectable
// stand-in so it can assert the PDF branch actually renders a WebView.
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: { source: { uri: string } }) => <View testID="webview" {...props} /> };
});

const baseReceipt = {
  image_url: "https://r2.example.com/r1.jpg",
  content_type: "image/jpeg",
};

test("renders a zoomable image for a non-PDF receipt", () => {
  render(<ReceiptViewer receipt={baseReceipt} />);
  expect(screen.getByLabelText("Fiş görseli")).toBeOnTheScreen();
  expect(screen.queryByTestId("webview")).toBeNull();
});

test("renders an inline PDF view when isPdf(receipt) is true", () => {
  render(<ReceiptViewer receipt={{ ...baseReceipt, content_type: "application/pdf" }} />);
  expect(screen.getByTestId("webview")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Fiş görseli")).toBeNull();
});
