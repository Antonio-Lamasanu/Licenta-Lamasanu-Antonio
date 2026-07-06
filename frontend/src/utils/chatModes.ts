export interface ChatCategory {
  id: string;
  label: string;
  icon: string;
  starters: string[];
}

export const CHAT_CATEGORIES: ChatCategory[] = [
  {
    id: "explore",
    label: "Explore",
    icon: "✨",
    starters: [
      "Ask me a few questions to help me figure out what this song is really about",
      "Give me 5 different metaphors I could build this song's theme around",
      "What's a strong hook or central line I could build this whole song around?",
      "Suggest 3 completely different directions this song could go from here",
      "What am I dancing around saying in these lyrics that I should just say directly?",
    ],
  },
  {
    id: "write",
    label: "Write",
    icon: "✎",
    starters: [
      "Write a full chorus based on the verse I have so far",
      "I have the idea but not the words — turn this into a proper verse",
      "Write a bridge that raises the emotional stakes before the last chorus",
      "Continue this verse in the same voice and keep the momentum going",
      "Give me 3 different opening lines for this song",
    ],
  },
  {
    id: "refine",
    label: "Refine",
    icon: "◆",
    starters: [
      "Which lines here are weakest, and why?",
      "Tighten this without losing the meaning — cut anything that's just filler",
      "Suggest stronger, more specific word choices for the vague parts of this",
      "This chorus feels generic — help me make it more personal and specific",
      "Does the story/emotion in this actually build, or does it stall somewhere?",
    ],
  },
  {
    id: "sound",
    label: "Sound",
    icon: "♪",
    starters: [
      "What's the rhyme scheme here, and is it consistent?",
      "Suggest some slant rhymes instead of perfect rhymes for a less sing-songy feel",
      "Check the syllable count across these lines — where does the rhythm break?",
      "This line doesn't scan right against the rest — help me fix the meter",
      "Read this out loud in your head — where does it stumble?",
    ],
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: "◎",
    starters: [
      "Give me honest feedback on this — what's working and what isn't?",
      "If a listener heard only this, what would they think the song is about?",
      "What's the most cliché line in here, and how would you fix it?",
      "Compare the verse and chorus — do they feel like they belong to the same song?",
    ],
  },
];
