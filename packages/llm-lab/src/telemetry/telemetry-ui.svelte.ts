/**
 * Shared open/closed state for the SessionTelemetry modal, so any component
 * (header trigger, FAB, command palette) can open the dashboard.
 *
 * Module-level singleton: all SessionTelemetry instances on a page share one
 * modal. Demos mount exactly one instance, so this is fine in practice.
 */
class TelemetryPanel {
  open = $state(false);

  show(): void {
    this.open = true;
  }

  hide(): void {
    this.open = false;
  }

  toggle(): void {
    this.open = !this.open;
  }
}

export const telemetryPanel = new TelemetryPanel();
