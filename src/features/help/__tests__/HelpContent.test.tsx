import { fireEvent, render, screen } from "@testing-library/react-native";
import { HelpContent } from "../HelpContent";

test("a taxpayer sees the receipt workflow, not the accountant's invite step", () => {
  render(<HelpContent role="client" onReplayIntro={jest.fn()} />);
  expect(screen.getByText(/muhasebecinize gönder/i)).toBeOnTheScreen();
  expect(screen.queryByText(/mükellef davet/i)).toBeNull();
});

test("an accountant sees the filing workflow, not the taxpayer's send step", () => {
  render(<HelpContent role="accountant" onReplayIntro={jest.fn()} />);
  expect(screen.getByText(/mükellef davet/i)).toBeOnTheScreen();
  expect(screen.queryByText(/muhasebecinize gönder/i)).toBeNull();
});

test("both roles can replay the introduction from the same action", () => {
  const onReplayIntro = jest.fn();
  render(<HelpContent role="client" onReplayIntro={onReplayIntro} />);
  fireEvent.press(screen.getByText(/tanıtım turunu tekrar izle/i));
  expect(onReplayIntro).toHaveBeenCalledTimes(1);
});
