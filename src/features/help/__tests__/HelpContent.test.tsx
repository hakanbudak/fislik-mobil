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

test("a client can replay the introduction, which is written for taxpayers", () => {
  const onReplayIntro = jest.fn();
  render(<HelpContent role="client" onReplayIntro={onReplayIntro} />);
  fireEvent.press(screen.getByText(/tanıtım turunu tekrar izle/i));
  expect(onReplayIntro).toHaveBeenCalledTimes(1);
});

test("an accountant is not offered the replay action, because the tour is taxpayer-framed", () => {
  render(<HelpContent role="accountant" onReplayIntro={jest.fn()} />);
  expect(screen.queryByText(/tanıtım turunu tekrar izle/i)).toBeNull();
});
