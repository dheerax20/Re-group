export const demoChurch = {
  name: "Grace Community Church",
  location: "Austin, TX",
  description:
    "A welcoming community dedicated to worship, fellowship, and serving our city.",
  tagline: "A place to belong",
};

export const demoMembers = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    groups: ["Worship", "Youth"],
    joined: "Jan 12, 2024",
    status: "Active" as const,
    initials: "SJ",
  },
  {
    id: "2",
    name: "Daniel Thomas",
    email: "daniel.t@email.com",
    groups: ["Men's Ministry"],
    joined: "Mar 3, 2024",
    status: "Active" as const,
    initials: "DT",
  },
  {
    id: "3",
    name: "Michael Carter",
    email: "michael.c@email.com",
    groups: ["Leadership", "Giving"],
    joined: "Nov 18, 2023",
    status: "Active" as const,
    initials: "MC",
  },
  {
    id: "4",
    name: "Emily Williams",
    email: "emily.w@email.com",
    groups: ["Children", "Hospitality"],
    joined: "Feb 22, 2025",
    status: "Pending" as const,
    initials: "EW",
  },
  {
    id: "5",
    name: "James Rivera",
    email: "james.r@email.com",
    groups: ["Outreach"],
    joined: "Jun 9, 2024",
    status: "Active" as const,
    initials: "JR",
  },
  {
    id: "6",
    name: "Olivia Chen",
    email: "olivia.c@email.com",
    groups: ["Worship", "Prayer"],
    joined: "Aug 1, 2024",
    status: "Inactive" as const,
    initials: "OC",
  },
];

export const demoEvents = [
  {
    id: "1",
    title: "Sunday Worship",
    date: "Sun, Mar 15 · 10:00 AM",
    location: "Main Sanctuary",
    attendees: 240,
    status: "Upcoming" as const,
    type: "Worship",
  },
  {
    id: "2",
    title: "Youth Night",
    date: "Fri, Mar 20 · 7:00 PM",
    location: "Youth Center",
    attendees: 68,
    status: "Upcoming" as const,
    type: "Youth",
  },
  {
    id: "3",
    title: "Community Dinner",
    date: "Sat, Mar 28 · 6:00 PM",
    location: "Fellowship Hall",
    attendees: 112,
    status: "Upcoming" as const,
    type: "Community",
  },
  {
    id: "4",
    title: "Bible Study",
    date: "Wed, Apr 2 · 7:30 PM",
    location: "Room 204",
    attendees: 34,
    status: "Upcoming" as const,
    type: "Study",
  },
  {
    id: "5",
    title: "Easter Sunrise Service",
    date: "Sun, Apr 5 · 6:30 AM",
    location: "Courtyard",
    attendees: 310,
    status: "Upcoming" as const,
    type: "Worship",
  },
  {
    id: "6",
    title: "Leadership Retreat",
    date: "Sat, Feb 14 · 9:00 AM",
    location: "Retreat Center",
    attendees: 22,
    status: "Past" as const,
    type: "Leadership",
  },
];

export const demoCourses = [
  {
    id: "1",
    title: "Foundations of Faith",
    instructor: "Pastor Mark Ellis",
    students: 48,
    lessons: 8,
    status: "Published" as const,
    progress: 72,
  },
  {
    id: "2",
    title: "Leadership Essentials",
    instructor: "Rev. Anna Brooks",
    students: 26,
    lessons: 6,
    status: "Published" as const,
    progress: 41,
  },
  {
    id: "3",
    title: "Discovering Scripture",
    instructor: "Dr. Paul Nguyen",
    students: 63,
    lessons: 12,
    status: "Draft" as const,
    progress: 0,
  },
];

export const demoStats = [
  { label: "Website visitors", value: "12,480", change: "+18%" },
  { label: "Upcoming events", value: "5", change: "+2" },
  { label: "Members", value: "384", change: "+12" },
  { label: "Courses", value: "3", change: "Active" },
];

export const demoActivity = [
  { id: "1", text: "Homepage hero updated", time: "2 hours ago" },
  { id: "2", text: "Sunday Worship published", time: "Yesterday" },
  { id: "3", text: "Emily Williams joined", time: "2 days ago" },
  { id: "4", text: "Foundations of Faith enrolled 4 students", time: "3 days ago" },
];

export type BuilderPageId =
  | "home"
  | "about"
  | "ministries"
  | "events"
  | "courses"
  | "contact";

export type BuilderSectionType =
  | "hero"
  | "events"
  | "about"
  | "course"
  | "community"
  | "footer";

export type BuilderSection = {
  id: string;
  type: BuilderSectionType;
  label: string;
  enabled: boolean;
  content: {
    heading: string;
    description: string;
    buttonLabel: string;
  };
};

export type BuilderTheme = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  buttonRadius: number;
  buttonStyle: "solid" | "outline" | "soft";
  containerWidth: "narrow" | "default" | "wide";
  sectionSpacing: "compact" | "default" | "spacious";
};

export type BuilderTemplateId = "modern" | "community" | "contemporary";

export const builderPages: { id: BuilderPageId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "ministries", label: "Ministries" },
  { id: "events", label: "Events" },
  { id: "courses", label: "Courses" },
  { id: "contact", label: "Contact" },
];

export const defaultBuilderSections: BuilderSection[] = [
  {
    id: "hero",
    type: "hero",
    label: "Hero",
    enabled: true,
    content: {
      heading: "Welcome to Grace Community Church",
      description:
        "Join us this Sunday for worship, community, and a place to belong.",
      buttonLabel: "Plan a Visit",
    },
  },
  {
    id: "events",
    type: "events",
    label: "Upcoming Events",
    enabled: true,
    content: {
      heading: "Upcoming Events",
      description: "Come gather with us throughout the week.",
      buttonLabel: "View all events",
    },
  },
  {
    id: "about",
    type: "about",
    label: "About Us",
    enabled: true,
    content: {
      heading: "About Us",
      description:
        "We are a church rooted in faith, growing in community, and serving our city with love.",
      buttonLabel: "Our story",
    },
  },
  {
    id: "course",
    type: "course",
    label: "Featured Course",
    enabled: true,
    content: {
      heading: "Featured Course",
      description: "Foundations of Faith — grow deeper with our 8-week journey.",
      buttonLabel: "Explore course",
    },
  },
  {
    id: "community",
    type: "community",
    label: "Community",
    enabled: true,
    content: {
      heading: "Life together",
      description: "Find your people in small groups, ministries, and serving teams.",
      buttonLabel: "Get connected",
    },
  },
  {
    id: "footer",
    type: "footer",
    label: "Footer",
    enabled: true,
    content: {
      heading: "Grace Community Church",
      description: "Austin, TX · Sundays at 10:00 AM",
      buttonLabel: "Contact us",
    },
  },
];

export const defaultBuilderTheme: BuilderTheme = {
  primary: "#134E4A",
  secondary: "#2A6F6A",
  background: "#FFFFFF",
  text: "#1C1917",
  accent: "#C4A574",
  headingFont: "Manrope",
  bodyFont: "Manrope",
  buttonRadius: 12,
  buttonStyle: "solid",
  containerWidth: "default",
  sectionSpacing: "default",
};

export const builderTemplates: {
  id: BuilderTemplateId;
  name: string;
  description: string;
  theme: Partial<BuilderTheme>;
}[] = [
  {
    id: "modern",
    name: "Modern Church",
    description: "Minimal + editorial layout with clean spacing.",
    theme: {
      primary: "#134E4A",
      accent: "#C4A574",
      background: "#FFFFFF",
    },
  },
  {
    id: "community",
    name: "Community Church",
    description: "Warm and welcoming, built for connection.",
    theme: {
      primary: "#3D4F3F",
      accent: "#D4A574",
      background: "#FFFCF8",
    },
  },
  {
    id: "contemporary",
    name: "Contemporary Church",
    description: "Bold contrast with modern energy.",
    theme: {
      primary: "#0F172A",
      accent: "#38BDF8",
      background: "#F8FAFC",
    },
  },
];
