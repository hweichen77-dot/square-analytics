export const ALL_CATEGORY_NAMES = ['Food', 'Drinks', 'Ice Cream', 'Ramen/Hot Food', 'Merch', 'Other'] as const
export type Category = typeof ALL_CATEGORY_NAMES[number]

const FOOD_KEYWORDS = [
  'takis', 'chips', 'doritos', 'cheetos', 'lays', 'pretzels', 'popcorn',
  'candy', 'gummy', 'chocolate', 'snickers', 'kitkat', 'reeses', 'skittles',
  'starburst', 'jolly rancher', 'nerds', 'haribo', 'cookie', 'brownie',
  'muffin', 'cracker', 'goldfish', 'oreo', 'rice crispy', 'granola', 'bar',
  'trail mix', 'beef jerky', 'jerky', 'slim jim', 'hot pocket', 'sandwich',
  'wrap', 'salad', 'fruit', 'apple', 'banana', 'orange', 'snack',
]

const DRINKS_KEYWORDS = [
  'water', 'gatorade', 'powerade', 'juice', 'lemonade', 'tea', 'coffee',
  'monster', 'redbull', 'red bull', 'bang', 'celsius', 'bodyarmor', 'body armor',
  'snapple', 'arizona', 'vitamin water', 'vitaminwater', 'sparkling', 'soda',
  'coke', 'pepsi', 'sprite', 'fanta', 'dr pepper', 'mountain dew', 'dew',
  'drink', 'beverage', 'smoothie', 'shake', 'milk', 'chocolate milk',
]

const ICE_CREAM_KEYWORDS = [
  'ice cream', 'popsicle', 'freeze pop', 'drumstick', 'klondike',
  'fudge bar', 'creamsicle', 'sorbet', 'gelato', 'frozen yogurt', 'froyo',
  'dippin dots', 'ice pop',
]

const RAMEN_KEYWORDS = [
  'ramen', 'noodle', 'instant noodle', 'cup noodle', 'maruchan',
  'nissin', 'top ramen', 'soup', 'hot food', 'nachos', 'pretzel dog',
  'hot dog', 'pizza', 'quesadilla', 'mac', 'macaroni',
]

export const MERCH_KEYWORDS = [
  'shirt', 't-shirt', 'hoodie', 'sweatshirt', 'jacket', 'hat', 'cap', 'beanie',
  'bag', 'backpack', 'lanyard', 'keychain', 'sticker', 'pen', 'pencil',
  'notebook', 'binder', 'folder', 'merch', 'merchandise', 'apparel', 'gear',
  'bracelet', 'wristband', 'pin', 'button', 'magnet', 'poster', 'flag',
]

const kwCache = new Map<string, RegExp>()
function hasKeyword(lower: string, keywords: string[]): boolean {
  return keywords.some(k => {
    let re = kwCache.get(k)
    if (!re) {
      re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
      kwCache.set(k, re)
    }
    return re.test(lower)
  })
}

export function classifyProduct(name: string, overrides: Record<string, string> = {}): string {
  if (overrides[name]) return overrides[name]
  const lower = name.toLowerCase()
  if (hasKeyword(lower, ICE_CREAM_KEYWORDS)) return 'Ice Cream'
  if (hasKeyword(lower, RAMEN_KEYWORDS)) return 'Ramen/Hot Food'
  if (hasKeyword(lower, DRINKS_KEYWORDS)) return 'Drinks'
  if (hasKeyword(lower, FOOD_KEYWORDS)) return 'Food'
  if (hasKeyword(lower, MERCH_KEYWORDS)) return 'Merch'
  return 'Other'
}
