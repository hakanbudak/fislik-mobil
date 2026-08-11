import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReceiptViewer } from "../ReceiptViewer";

// react-native-webview pulls in a native module that jest-expo can't
// resolve; the only thing this test needs from it is a mockable, inspectable
// stand-in so it can assert the PDF branch actually renders a WebView, and
// fire its onError/onHttpError props to simulate a stale presigned URL.
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return {
    WebView: (props: { source: { uri: string }; onError?: () => void; onHttpError?: () => void }) => (
      <View testID="webview" {...props} />
    ),
  };
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

test("shows a failure state with a retry affordance when the image fails to load", () => {
  render(<ReceiptViewer receipt={baseReceipt} />);
  fireEvent(screen.getByLabelText("Fiş görseli"), "onError");
  expect(screen.getByText("Fiş yüklenemedi, tekrar deneyin.")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Fiş görseli")).toBeNull();

  fireEvent.press(screen.getByText("Tekrar dene"));
  expect(screen.getByLabelText("Fiş görseli")).toBeOnTheScreen();
  expect(screen.queryByText("Fiş yüklenemedi, tekrar deneyin.")).toBeNull();
});

test("shows a failure state with a retry affordance when the PDF fails to load (onError)", () => {
  render(<ReceiptViewer receipt={{ ...baseReceipt, content_type: "application/pdf" }} />);
  fireEvent(screen.getByTestId("webview"), "onError");
  expect(screen.getByText("Fiş yüklenemedi, tekrar deneyin.")).toBeOnTheScreen();
  expect(screen.queryByTestId("webview")).toBeNull();

  fireEvent.press(screen.getByText("Tekrar dene"));
  expect(screen.getByTestId("webview")).toBeOnTheScreen();
});

test("shows a failure state when the PDF fails to load via onHttpError", () => {
  render(<ReceiptViewer receipt={{ ...baseReceipt, content_type: "application/pdf" }} />);
  fireEvent(screen.getByTestId("webview"), "onHttpError");
  expect(screen.getByText("Fiş yüklenemedi, tekrar deneyin.")).toBeOnTheScreen();
  expect(screen.queryByTestId("webview")).toBeNull();
});
