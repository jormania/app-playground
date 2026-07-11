export interface Quote {
  text: string;
  author: string;
  source: string;
  tags?: string[];
}

export const QUOTES: Quote[] = [
  {
    text: "You have power over your mind - not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
    source: "Meditations",
    tags: ["Acceptance"]
  },
  {
    text: "The happiness of your life depends upon the quality of your thoughts.",
    author: "Marcus Aurelius",
    source: "Meditations",
    tags: ["Acceptance"]
  },
  {
    text: "We suffer more often in imagination than in reality.",
    author: "Seneca",
    source: "Letters from a Stoic",
    tags: ["Resistance"]
  },
  {
    text: "Waste no more time arguing about what a good man should be. Be one.",
    author: "Marcus Aurelius",
    source: "Meditations",
    tags: ["Fate"]
  },
  {
    text: "Associate with people who are likely to improve you.",
    author: "Seneca",
    source: "Letters from a Stoic",
    tags: []
  },
  {
    text: "It is not that we have a short time to live, but that we waste a lot of it.",
    author: "Seneca",
    source: "On the Shortness of Life",
    tags: ["Resistance"]
  },
  {
    text: "The best revenge is to be unlike him who performed the injury.",
    author: "Marcus Aurelius",
    source: "Meditations",
    tags: ["Acceptance"]
  },
  {
    text: "If a man knows not which port he sails on, no wind is favorable.",
    author: "Seneca",
    source: "Letters from a Stoic",
    tags: ["Fate"]
  },
  {
    text: "When you arise in the morning think of what a privilege it is to be alive, to think, to enjoy, to love...",
    author: "Marcus Aurelius",
    source: "Meditations",
    tags: ["Acceptance"]
  },
  {
    text: "He who fears death will never do anything worthy of a man who is alive.",
    author: "Seneca",
    source: "On Moral Essays",
    tags: ["Fate"]
  }
];
