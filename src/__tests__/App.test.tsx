import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("renders mobile-first live result modules from fetched data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("statewise")) {
          return {
            ok: true,
            text: async () => `
              <table class="table">
                <thead><tr><th colspan="9">Status Known For 1 out of 2 Constituencies</th></tr></thead>
                <tbody>
                  <tr>
                    <td>ALIPURDUARS</td><td>12</td><td>PARITOSH DAS</td>
                    <td><table><tbody><tr><td align="left">Bharatiya Janata Party</td></tr></tbody></table></td>
                    <td>SUMAN KANJILAL</td>
                    <td><table><tbody><tr><td align="left">All India Trinamool Congress</td></tr></tbody></table></td>
                    <td>250</td><td>2/22</td><td>Result in Progress</td>
                  </tr>
                </tbody>
              </table>`
          };
        }
        return {
          ok: true,
          json: async () => ({
            S25: {
              chartData: [
                ["BJP", "S25", 12, "PARITOSH DAS", "#ff944d"],
                ["AITC", "S25", 13, "AITC CANDIDATE", "#05a"]
              ],
              tableData: []
            }
          })
        };
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(await screen.findByText("West Bengal (S25)")).toBeInTheDocument();
    expect(screen.getByText("Party position and counting pace")).toBeInTheDocument();
    expect(screen.getByText("Race pressure")).toBeInTheDocument();
    expect(screen.getByText("Margin spread")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search seat, candidate, party")).toBeInTheDocument();
    const partySelect = screen.getByLabelText("Filter constituencies by party");
    expect(partySelect).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "BJP (1)" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "AITC (1)" })).toBeInTheDocument();
    expect((await screen.findAllByText("Round 2/22")).length).toBeGreaterThan(0);
    fireEvent.change(partySelect, { target: { value: "AITC" } });
    expect(await screen.findByText("AITC CANDIDATE")).toBeInTheDocument();
    expect(screen.queryByText("ALIPURDUARS")).not.toBeInTheDocument();
    expect(await screen.findByText("Status known 1/2")).toBeInTheDocument();
  });
});
