import {
  CalendarCheck,
  Globe,
  Mic2,
  PanelsTopLeft,
  QrCode,
  Users,
} from "lucide-react";

import { Reveal } from "@/components/marketing/motion-primitives";

/**
 * What sits where social proof normally goes.
 *
 * There are no customers to name yet, so there is no logo row here. A wall of
 * greyed-out invented logos is the single most corrosive thing a young product
 * can put under its hero — anyone who recognises one of the names knows
 * immediately that the rest are fiction.
 *
 * Instead this states the scope of the product in six words, which is the other
 * job that band was doing: telling a visitor whether this thing covers what
 * they need before they scroll another screen. Swap it for a real logo row the
 * day there are real logos.
 */

const CAPABILITIES = [
  { icon: PanelsTopLeft, label: "Website builder" },
  { icon: CalendarCheck, label: "Events & RSVP" },
  { icon: QrCode, label: "QR check-in" },
  { icon: Users, label: "Attendance" },
  { icon: Mic2, label: "Sermons" },
  { icon: Globe, label: "Custom domains" },
];

export function TrustLine() {
  return (
    <section className="border-y border-border bg-surface-muted/40 px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-[13px] text-muted">
            Built for churches that want to move faster.
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-7 gap-y-3.5">
            {CAPABILITIES.map((item) => (
              <li
                className="flex items-center gap-2 text-[14px] font-medium text-foreground/70"
                key={item.label}
              >
                <item.icon className="size-4 shrink-0 text-brand" />
                {item.label}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
