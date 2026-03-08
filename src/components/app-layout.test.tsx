import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AppLayout } from "@/components/app-layout";

function TestHomePage() {
  return <div>Home page content</div>;
}

function TestSettingsPage() {
  return <div>Settings page content</div>;
}

describe("AppLayout", () => {
  it("renders the shell with an accessible brand icon on the home route", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          Component: AppLayout,
          children: [
            {
              index: true,
              Component: TestHomePage,
            },
            {
              path: "settings",
              Component: TestSettingsPage,
            },
          ],
        },
      ],
      {
        initialEntries: ["/"],
      },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText("WR AI Manager")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /tauri starter/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText("Home page content")).toBeInTheDocument();
    expect(screen.getByLabelText(/wr ai manager brand/i)).toBeInTheDocument();
  });
});
