// words.js - categorized word list for the drawing game
const WORDS = {
  animals: [
    "elephant", "giraffe", "penguin", "kangaroo", "dolphin", "octopus",
    "butterfly", "crocodile", "squirrel", "flamingo", "hedgehog", "raccoon"
  ],
  objects: [
    "umbrella", "telephone", "backpack", "candle", "scissors", "guitar",
    "bicycle", "balloon", "ladder", "anchor", "telescope", "wheelchair"
  ],
  food: [
    "pizza", "hamburger", "watermelon", "icecream", "popcorn", "sandwich",
    "pancake", "spaghetti", "strawberry", "pineapple", "donut", "taco"
  ],
  actions: [
    "running", "sleeping", "dancing", "swimming", "jumping", "laughing",
    "singing", "cooking", "painting", "fishing", "climbing", "skating"
  ],
  places: [
    "beach", "mountain", "castle", "airport", "library", "hospital",
    "volcano", "desert", "jungle", "lighthouse", "stadium", "waterfall"
  ]
};

function getAllWords() {
  return Object.values(WORDS).flat();
}

function getRandomWords(count = 3, categories = null) {
  const pool = categories && categories.length
    ? categories.flatMap((c) => WORDS[c] || [])
    : getAllWords();

  const shuffled = [...new Set(pool)].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

module.exports = { WORDS, getAllWords, getRandomWords };
