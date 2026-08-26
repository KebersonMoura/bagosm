import { Ingredient } from '../types';

export interface CategoryLimits {
  maxFreeCheese: number;
  maxFreeVeggies: number;
  maxFreeSauces: number;
}

export const ASSEMBLY_LIMITS: Record<'sandwich' | 'salad', CategoryLimits> = {
  sandwich: {
    maxFreeCheese: 1,
    maxFreeVeggies: 3,
    maxFreeSauces: 2,
  },
  salad: {
    maxFreeCheese: 1,
    maxFreeVeggies: 5,
    maxFreeSauces: 2,
  }
};

/**
 * Calculates total extra cost for items that exceed the category free limits.
 */
export function calculateAssemblyExtras(params: {
  format: 'sandwich' | 'salad';
  selectedCheeses: string[];
  selectedVeggies: string[];
  selectedSauces: string[];
  selectedExtraProteins?: string[];
  selectedExtraCheeses?: string[];
  selectedExtras?: string[];
  ingredientsList: Ingredient[];
}): number {
  const formatKey = params.format === 'salad' ? 'salad' : 'sandwich';
  const limits = ASSEMBLY_LIMITS[formatKey];
  let extraTotal = 0;

  // 1. Cheeses (1st free, 2nd+ paid)
  params.selectedCheeses.forEach((cheeseName, index) => {
    if (index >= limits.maxFreeCheese) {
      const ing = params.ingredientsList.find(i => i.name === cheeseName && i.category === 'cheese');
      extraTotal += ing?.price && ing.price > 0 ? ing.price : 3.50;
    }
  });

  // 2. Veggies (3 free for sandwich, 5 free for salad)
  params.selectedVeggies.forEach((vegName, index) => {
    if (index >= limits.maxFreeVeggies) {
      const ing = params.ingredientsList.find(
        i => i.name === vegName && ((i.category as string) === 'vegetable' || (i.category as string) === 'salad')
      );
      extraTotal += ing?.price && ing.price > 0 ? ing.price : 2.50;
    }
  });

  // 3. Sauces (2 free for both)
  params.selectedSauces.forEach((sauceName, index) => {
    if (index >= limits.maxFreeSauces) {
      const ing = params.ingredientsList.find(i => i.name === sauceName && i.category === 'sauce');
      extraTotal += ing?.price && ing.price > 0 ? ing.price : 2.00;
    }
  });

  // 4. Extra Proteins (Paid additional protein)
  if (params.selectedExtraProteins && params.selectedExtraProteins.length > 0) {
    params.selectedExtraProteins.forEach((protName) => {
      const ing = params.ingredientsList.find(i => i.name === protName && i.category === 'protein');
      extraTotal += ing?.price && ing.price > 0 ? ing.price : 6.50;
    });
  }

  // 5. Extra Cheeses (Paid additional cheese)
  if (params.selectedExtraCheeses && params.selectedExtraCheeses.length > 0) {
    params.selectedExtraCheeses.forEach((cheeseName) => {
      const ing = params.ingredientsList.find(i => i.name === cheeseName && i.category === 'cheese');
      extraTotal += ing?.price && ing.price > 0 ? ing.price : 4.50;
    });
  }

  // 6. General Extra Addons
  if (params.selectedExtras && params.selectedExtras.length > 0) {
    params.selectedExtras.forEach((extraName) => {
      if (extraName.startsWith('Proteína Extra: ') || extraName.startsWith('Queijo Extra: ')) return; // Already counted above
      const ing = params.ingredientsList.find(i => i.name === extraName && ((i.category as string) === 'extra' || (i.category as string) === 'addon'));
      if (ing) {
        extraTotal += ing.price > 0 ? ing.price : 4.00;
      }
    });
  }

  return extraTotal;
}

/**
 * Gets the status (isIncluded, isPaidExtra, priceToShow, badgeText) for an option in cheese/veggie/sauce categories.
 */
export function getOptionStatus(params: {
  category: 'cheese' | 'vegetable' | 'sauce';
  itemName: string;
  format: 'sandwich' | 'salad';
  selectedItems: string[];
  itemPrice: number;
}) {
  const formatKey = params.format === 'salad' ? 'salad' : 'sandwich';
  const limits = ASSEMBLY_LIMITS[formatKey];

  let limit = 1;
  let categoryLabel = 'Queijo';
  let defaultFallbackPrice = 3.50;

  if (params.category === 'cheese') {
    limit = limits.maxFreeCheese;
    categoryLabel = 'queijo';
    defaultFallbackPrice = 3.50;
  } else if (params.category === 'vegetable') {
    limit = limits.maxFreeVeggies;
    categoryLabel = 'salada';
    defaultFallbackPrice = 2.50;
  } else if (params.category === 'sauce') {
    limit = limits.maxFreeSauces;
    categoryLabel = 'molho';
    defaultFallbackPrice = 2.00;
  }

  const rawPrice = params.itemPrice > 0 ? params.itemPrice : defaultFallbackPrice;
  const price = Number(rawPrice) || 0;
  const selectedIndex = params.selectedItems.indexOf(params.itemName);
  const isSelected = selectedIndex !== -1;

  if (isSelected) {
    if (selectedIndex < limit) {
      return {
        isSelected: true,
        isIncluded: true,
        isPaidExtra: false,
        extraPrice: 0,
        badgeText: 'Incluso',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      };
    } else {
      return {
        isSelected: true,
        isIncluded: false,
        isPaidExtra: true,
        extraPrice: price,
        badgeText: `+ R$ ${price.toFixed(2)}`,
        badgeColor: 'bg-amber-100 text-amber-900 font-extrabold border-amber-300'
      };
    }
  } else {
    // Unselected item
    const remainingFree = limit - params.selectedItems.length;
    if (remainingFree > 0) {
      return {
        isSelected: false,
        isIncluded: true,
        isPaidExtra: false,
        extraPrice: 0,
        badgeText: remainingFree === limit ? `Incluso (${limit} grátis)` : `Incluso (+${remainingFree} grátis)`,
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-200'
      };
    } else {
      return {
        isSelected: false,
        isIncluded: false,
        isPaidExtra: false,
        extraPrice: price,
        badgeText: `+ R$ ${price.toFixed(2)}`,
        badgeColor: 'bg-amber-50 text-amber-700 font-bold border-amber-200'
      };
    }
  }
}
