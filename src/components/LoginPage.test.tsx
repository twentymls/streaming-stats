import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import { LoginPage } from "./LoginPage";

vi.mock("../lib/supabase", () => {
  const mockSignIn = vi.fn(async () => ({
    data: { user: { id: "user-123", email: "test@test.com" } },
    error: null,
  }));
  const mockSignUp = vi.fn(async () => ({
    data: { user: { id: "user-123", email: "test@test.com" } },
    error: null,
  }));
  return {
    supabase: {
      auth: {
        signInWithPassword: mockSignIn,
        signUp: mockSignUp,
      },
    },
  };
});

describe("LoginPage", () => {
  it("renders sign in form by default", () => {
    render(<LoginPage onSignIn={() => {}} />);
    expect(screen.getByText("Sign in to view your streaming analytics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("toggles to sign up mode", async () => {
    const user = userEvent.setup();
    render(<LoginPage onSignIn={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("calls onSignIn after successful sign in", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    render(<LoginPage onSignIn={onSignIn} />);

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSignIn).toHaveBeenCalledWith(expect.objectContaining({ id: "user-123" }));
  });
});
