import { render, screen } from "@testing-library/react-native";
import { Input } from "../Input";

test("exposes the label as the accessibility label", () => {
  render(<Input label="E-posta" />);
  expect(screen.getByLabelText("E-posta")).toBeOnTheScreen();
});

test("renders the error text when given", () => {
  render(<Input label="Şifre" error="Şifre gerekli" />);
  expect(screen.getByText("Şifre gerekli")).toBeOnTheScreen();
});

test("forwards TextInput props such as value and placeholder", () => {
  render(<Input label="E-posta" placeholder="ornek@firma.com" value="a@b.com" onChangeText={() => {}} />);
  expect(screen.getByPlaceholderText("ornek@firma.com").props.value).toBe("a@b.com");
});
