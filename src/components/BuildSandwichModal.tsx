import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeft, 
  Check, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Sparkles, 
  Wheat, 
  Flame, 
  AlertCircle, 
  Share2,
  ChevronRight,
  Coffee
} from 'lucide-react';
import { CustomSandwich, Ingredient, ReadyProduct } from '../types';

interface BuildSandwichModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormat?: 'sandwich' | 'salad';
  initialProduct?: ReadyProduct | null;
  ingredients: Ingredient[];
  readyProducts?: ReadyProduct[];
  onAddToCart: (item: {
    sandwichConfig?: CustomSandwich;
    productName?: string;
    isReadyProduct?: boolean;
    price: number;
    quantity: number;
    notes?: string;
  }) => void;
  isPos?: boolean;
}

export const BuildSandwichModal: React.FC<BuildSandwichModalProps> = ({
  isOpen,
  onClose,
  initialFormat = 'sandwich',
  initialProduct = null,
  ingredients = [],
  readyProducts = [],
  onAddToCart,
  isPos = false
}) => {
  const [bagoFormat, setBagoFormat] = useState<'sandwich' | 'salad'>(initialFormat);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedBread, setSelectedBread] = useState<string>('');
  const [selectedProtein, setSelectedProtein] = useState<string>('');
  const [selectedCheese, setSelectedCheese] = useState<string>('Mussarela');
  const [selectedVeggies, setSelectedVeggies] = useState<string[]>([]);
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedExtraProteins, setSelectedExtraProteins] = useState<string[]>([]);
  const [selectedExtraCheeses, setSelectedExtraCheeses] = useState<string[]>([]);
  const [toasted, setToasted] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>([]);

  // Default beverage lists
  const defaultRefrigerantes = [
    { name: 'Coca-Cola Lata 350ml', price: 6.00 },
    { name: 'Coca-Cola Zero 350ml', price: 6.00 },
    { name: 'Guaraná Antarctica 350ml', price: 6.00 },
    { name: 'Guaraná Zero 350ml', price: 6.00 },
    { name: 'Fanta Laranja 350ml', price: 6.00 },
    { name: 'Sprite 350ml', price: 6.00 },
    { name: 'Água Mineral Sem Gás 500ml', price: 4.00 },
    { name: 'Água Mineral Com Gás 500ml', price: 4.50 },
  ];

  // Extract refrigerantes & águas registered in Database (readyProducts & ingredients)
  const dbRefrigerantesFromReady = (readyProducts || []).filter(p => {
    const cat = (p.category || '').toLowerCase();
    const sub = (p.subcategory || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    const isDrinkCat = cat === 'drink' || cat === 'beverage' || cat === 'drinks' || sub.includes('refrigerante') || sub.includes('bebida') || id.startsWith('ref-') || id.startsWith('beb-');
    const isNotSucoOrVitamina = !name.includes('suco') && !name.includes('vitamina') && !name.includes('smoothie') && !sub.includes('suco') && !sub.includes('vitamina') && cat !== 'juice' && cat !== 'vitamin';
    return isDrinkCat && isNotSucoOrVitamina;
  }).map(p => ({
    name: p.name,
    price: p.price,
    id: p.id
  }));

  const dbRefrigerantesFromIngredients = (ingredients || []).filter(i => {
    const cat = (i.category || '').toLowerCase();
    const name = (i.name || '').toLowerCase();
    const isDrinkCat = cat === 'drink' || cat === 'drink_cookie' || cat === 'beverage';
    const isNotSucoOrVitamina = !name.includes('suco') && !name.includes('vitamina') && !name.includes('smoothie') && !name.includes('cookie');
    return isDrinkCat && isNotSucoOrVitamina;
  }).filter(i => !dbRefrigerantesFromReady.some(p => p.name.toLowerCase() === i.name.toLowerCase()))
  .map(i => ({
    name: i.name,
    price: i.price,
    id: i.id
  }));

  const dbRefrigerantesCombined = [...dbRefrigerantesFromReady, ...dbRefrigerantesFromIngredients];
  const refrigerantesList = dbRefrigerantesCombined.length > 0 ? dbRefrigerantesCombined : defaultRefrigerantes;

  const defaultSucos = [
    { name: 'Suco de Laranja Natural 330ml', price: 7.50 },
    { name: 'Suco de Laranja Natural 500ml', price: 9.50 },
    { name: 'Suco de Acerola 330ml', price: 7.50 },
    { name: 'Suco de Acerola 500ml', price: 9.50 },
    { name: 'Suco de Maracujá 330ml', price: 8.00 },
    { name: 'Suco de Maracujá 500ml', price: 10.00 },
    { name: 'Suco de Limão (Limonada) 330ml', price: 7.00 },
    { name: 'Suco de Limão (Limonada) 500ml', price: 9.00 },
    { name: 'Suco de Morango Natural 330ml', price: 8.50 },
    { name: 'Suco de Morango Natural 500ml', price: 10.50 },
  ];

  // Extract juices registered in Database (readyProducts & ingredients)
  const dbSucosFromReady = (readyProducts || []).filter(p => {
    const cat = (p.category || '').toLowerCase();
    const sub = (p.subcategory || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    return (
      cat === 'juice' ||
      sub.includes('suco') ||
      id.startsWith('suc-') ||
      name.includes('suco')
    );
  }).map(p => ({
    name: p.name,
    price: p.price,
    id: p.id
  }));

  const dbSucosFromIngredients = (ingredients || []).filter(i => {
    const cat = (i.category || '').toLowerCase();
    const sub = (i.subcategory || '').toLowerCase();
    const name = (i.name || '').toLowerCase();
    const id = (i.id || '').toLowerCase();
    return (
      cat === 'juice' ||
      sub.includes('suco') ||
      id.startsWith('suc-') ||
      (cat === 'drink_cookie' && name.includes('suco'))
    );
  }).filter(i => !dbSucosFromReady.some(p => p.name.toLowerCase() === i.name.toLowerCase()))
  .map(i => ({
    name: i.name,
    price: i.price,
    id: i.id
  }));

  const dbSucosCombined = [...dbSucosFromReady, ...dbSucosFromIngredients];
  const sucosList = dbSucosCombined.length > 0 ? dbSucosCombined : defaultSucos;

  const defaultVitaminas = [
    { name: 'Vitamina de Banana 330ml', price: 8.50 },
    { name: 'Vitamina de Banana 500ml', price: 10.50 },
    { name: 'Vitamina de Abacate 330ml', price: 9.00 },
    { name: 'Vitamina de Abacate 500ml', price: 11.00 },
    { name: 'Vitamina de Mamão c/ Banana 330ml', price: 9.00 },
    { name: 'Vitamina de Mamão c/ Banana 500ml', price: 11.00 },
    { name: 'Vitamina de Açaí c/ Leite 330ml', price: 10.00 },
    { name: 'Vitamina de Açaí c/ Leite 500ml', price: 12.00 },
    { name: 'Vitamina Mista (Banana, Mamão e Maçã) 330ml', price: 9.50 },
    { name: 'Vitamina Mista (Banana, Mamão e Maçã) 500ml', price: 11.50 },
  ];

  // Extract vitamins registered in Database (readyProducts & ingredients)
  const dbVitaminasFromReady = (readyProducts || []).filter(p => {
    const cat = (p.category || '').toLowerCase();
    const sub = (p.subcategory || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    return (
      cat === 'vitamin' ||
      cat === 'vitamin_smoothie' ||
      sub.includes('vitamina') ||
      id.startsWith('vit-') ||
      name.includes('vitamina')
    );
  }).map(p => ({
    name: p.name,
    price: p.price,
    id: p.id
  }));

  const dbVitaminasFromIngredients = (ingredients || []).filter(i => {
    const cat = (i.category || '').toLowerCase();
    const sub = (i.subcategory || '').toLowerCase();
    const name = (i.name || '').toLowerCase();
    const id = (i.id || '').toLowerCase();
    return (
      cat === 'vitamin' ||
      sub.includes('vitamina') ||
      id.startsWith('vit-') ||
      (cat === 'drink_cookie' && name.includes('vitamina'))
    );
  }).filter(i => !dbVitaminasFromReady.some(p => p.name.toLowerCase() === i.name.toLowerCase()))
  .map(i => ({
    name: i.name,
    price: i.price,
    id: i.id
  }));

  const dbVitaminasCombined = [...dbVitaminasFromReady, ...dbVitaminasFromIngredients];
  const vitaminasList = dbVitaminasCombined.length > 0 ? dbVitaminasCombined : defaultVitaminas;

  // Default protein lists if ingredients are loading
  const defaultProteins = [
    { name: 'Camarão', price: 26.00 },
    { name: 'Carne de sol desf.', price: 16.00 },
    { name: 'Filé mignon', price: 16.00 },
    { name: 'Frango crocante', price: 14.00 },
    { name: 'Frango defumado', price: 15.00 },
    { name: 'Frango grelhado', price: 15.00 },
    { name: 'Peperonni', price: 16.00 },
    { name: 'Teriyaki', price: 15.00 },
    { name: 'Atum com Maionese', price: 13.00 },
    { name: 'Veggie Falafel', price: 12.00 }
  ];

  // Default breads
  const defaultBreads = [
    { name: 'Pão Ciabatta', price: 0 },
    { name: 'Pão 3 Queijos', price: 0 },
    { name: 'Pão Parmesão & Orégano', price: 0 },
    { name: 'Pão Italiano Integral', price: 0 },
    { name: 'Pão Australiano', price: 1.50 }
  ];

  // Default cheeses
  const defaultCheeses = [
    { name: 'Mussarela', price: 0 },
    { name: 'Prato', price: 0 },
    { name: 'Cheddar Cremoso', price: 0 },
    { name: 'Cream Cheese Genuíno', price: 2.50 },
    { name: 'Sem Queijo', price: 0 }
  ];

  // Default veggies
  const defaultVeggies = [
    'Alface Americana',
    'Tomate Fresco',
    'Azeitonas Pretas',
    'Cebola Roxa',
    'Milho Verde',
    'Pepino Crocante',
    'Pimenta Jalapeño'
  ];

  // Default sauces
  const defaultSauces = [
    'Maionese da Casa',
    'Mostarda e Mel',
    'Barbecue Artesanal',
    'Chipotle Picante',
    'Parmesão Gourmet',
    'Sem Molho'
  ];

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setNotes('');
      const format = initialProduct?.category === 'salad' ? 'salad' : initialFormat;
      setBagoFormat(format);

      if (format === 'salad') {
        setSelectedBread('Sem Pão (Tigela de Salada)');
      } else {
        const defaultBread = initialProduct?.sandwichConfig?.bread || ingredients.find(i => i.category === 'bread')?.name || defaultBreads[0].name;
        setSelectedBread(defaultBread);
      }

      const defaultProtein = initialProduct?.sandwichConfig?.protein || initialProduct?.name;
      if (defaultProtein) {
        setSelectedProtein(defaultProtein);
      } else {
        const firstProtein = ingredients.find(i => i.category === 'protein')?.name || defaultProteins[3].name;
        setSelectedProtein(firstProtein);
      }

      if (initialProduct?.sandwichConfig?.cheese) {
        setSelectedCheese(initialProduct.sandwichConfig.cheese);
      } else if (!initialProduct) {
        const firstCheese = ingredients.find(i => i.category === 'cheese')?.name || defaultCheeses[0].name;
        setSelectedCheese(firstCheese || 'Mussarela');
      } else {
        setSelectedCheese('Sem Queijo');
      }

      if (initialProduct?.sandwichConfig?.veggies?.length) {
        setSelectedVeggies(initialProduct.sandwichConfig.veggies);
      } else {
        setSelectedVeggies([]);
      }

      if (initialProduct?.sandwichConfig?.sauces?.length) {
        setSelectedSauces(initialProduct.sandwichConfig.sauces);
      } else {
        setSelectedSauces([]);
      }

      if (initialProduct?.sandwichConfig?.extras?.length) {
        setSelectedExtras(initialProduct.sandwichConfig.extras);
      } else {
        setSelectedExtras([]);
      }

      setSelectedExtraProteins([]);
      setSelectedExtraCheeses([]);
      if (initialProduct?.sandwichConfig?.drinksAndCookies?.length) {
        setSelectedDrinks(initialProduct.sandwichConfig.drinksAndCookies);
      } else {
        setSelectedDrinks([]);
      }
      setToasted(initialProduct?.sandwichConfig?.toasted ?? true);
    }
  }, [isOpen, initialFormat, initialProduct]);

  if (!isOpen) return null;

  // Filter available ingredients or use defaults
  const breadList = ingredients.filter(i => i.category === 'bread').length > 0 
    ? ingredients.filter(i => i.category === 'bread') 
    : defaultBreads;

  const proteinList = ingredients.filter(i => i.category === 'protein').length > 0 
    ? ingredients.filter(i => i.category === 'protein') 
    : defaultProteins;

  const cheeseList = ingredients.filter(i => i.category === 'cheese').length > 0 
    ? ingredients.filter(i => i.category === 'cheese') 
    : defaultCheeses;

  const rawVeggies = ingredients.filter(i => i.category === 'vegetable').length > 0 
    ? ingredients.filter(i => i.category === 'vegetable').map(i => i.name) 
    : defaultVeggies;

  const veggieList = rawVeggies.includes('Sem Salada') ? rawVeggies : [...rawVeggies, 'Sem Salada'];

  const rawSauces = ingredients.filter(i => i.category === 'sauce').length > 0 
    ? ingredients.filter(i => i.category === 'sauce').map(i => i.name) 
    : defaultSauces;

  const sauceList = rawSauces.includes('Sem Molho') ? rawSauces : [...rawSauces, 'Sem Molho'];

  const extraList = ingredients.filter(i => i.category === 'extra').length > 0
    ? ingredients.filter(i => i.category === 'extra')
    : [
        { name: 'Bacon Crocante', price: 4.50 },
        { name: 'Dobra de Proteína', price: 8.00 },
        { name: 'Dobra de Queijo', price: 3.50 }
      ];

  // Calculate Total Unit Price
  const calculateUnitPrice = (): number => {
    let price = 14.00; // Base sandwich/salad price

    if (initialProduct && initialProduct.price > 0) {
      price = initialProduct.price; // Start with full product price (includes bread, protein, cheese)
      
      // If user selected a different main protein than the default
      const defaultProt = initialProduct.sandwichConfig?.protein || initialProduct.name;
      if (selectedProtein && defaultProt && selectedProtein !== defaultProt) {
        const foundProt = proteinList.find((p: any) => p.name === selectedProtein);
        if (foundProt && foundProt.price > 0) {
          price += foundProt.price;
        }
      }
    } else {
      // Custom sandwich from scratch
      const foundReady = readyProducts.find(p => p.name.toLowerCase() === selectedProtein.toLowerCase());
      if (foundReady && foundReady.price > 0) {
        price = foundReady.price;
      } else {
        const foundProt = proteinList.find((p: any) => p.name === selectedProtein);
        if (foundProt && foundProt.price > 0) {
          price = foundProt.price;
        }
      }
    }

    // Additional Proteins chosen in "Escolha Proteína Adicionais:"
    selectedExtraProteins.forEach(extraProtName => {
      const foundProt = proteinList.find((p: any) => p.name === extraProtName);
      if (foundProt && foundProt.price > 0) {
        price += foundProt.price;
      } else {
        price += 14.00;
      }
    });

    // Additional Cheeses chosen in "Escolha Queijos Adicionais:"
    // 1st extra cheese is FREE (Incluso), 2nd+ extra cheese costs DB price
    selectedExtraCheeses.forEach((extraCheeseName, idx) => {
      if (idx >= 1) {
        const foundC = ingredients.find(i => i.category === 'cheese' && i.name === extraCheeseName) || cheeseList.find((c: any) => c.name === extraCheeseName);
        const itemPrice = (foundC && typeof foundC.price === 'number' && foundC.price > 0) ? foundC.price : 3.50;
        price += itemPrice;
      }
    });

    // Veggies extra price (3 free options for sandwich, 5 for salad)
    const realVeggies = selectedVeggies.filter(v => v !== 'Sem Salada');
    const veggieLimit = bagoFormat === 'salad' ? 5 : 3;
    realVeggies.forEach((vegName, idx) => {
      if (idx >= veggieLimit) {
        const foundVeg = ingredients.find(i => i.category === 'vegetable' && i.name === vegName);
        const itemPrice = (foundVeg && typeof foundVeg.price === 'number' && foundVeg.price > 0) ? foundVeg.price : 1.50;
        price += itemPrice;
      }
    });

    // Sauces extra price (2 free options)
    const realSauces = selectedSauces.filter(s => s !== 'Sem Molho');
    const sauceLimit = 2;
    realSauces.forEach((sauceName, idx) => {
      if (idx >= sauceLimit) {
        const foundSauce = ingredients.find(i => i.category === 'sauce' && i.name === sauceName);
        const itemPrice = (foundSauce && typeof foundSauce.price === 'number' && foundSauce.price > 0) ? foundSauce.price : 1.50;
        price += itemPrice;
      }
    });

    // Extras
    selectedExtras.forEach(extraName => {
      const foundExtra = extraList.find((e: any) => e.name === extraName);
      if (foundExtra && foundExtra.price > 0) {
        price += foundExtra.price;
      } else {
        price += 3.50;
      }
    });

    // Drinks selected
    selectedDrinks.forEach(drinkName => {
      const foundReady = readyProducts.find(p => p.name.toLowerCase() === drinkName.toLowerCase());
      const foundIng = ingredients.find(i => i.name.toLowerCase() === drinkName.toLowerCase());
      if (foundReady && typeof foundReady.price === 'number' && foundReady.price > 0) {
        price += foundReady.price;
      } else if (foundIng && typeof foundIng.price === 'number' && foundIng.price > 0) {
        price += foundIng.price;
      } else {
        const allDefs = [...defaultRefrigerantes, ...sucosList, ...vitaminasList];
        const foundDef = allDefs.find(d => d.name === drinkName);
        if (foundDef && foundDef.price > 0) {
          price += foundDef.price;
        } else {
          price += 6.00;
        }
      }
    });

    return price;
  };

  const unitPrice = calculateUnitPrice();
  const totalPrice = unitPrice * quantity;

  // Toggle helpers
  const toggleExtraProtein = (name: string) => {
    if (selectedExtraProteins.includes(name)) {
      setSelectedExtraProteins(selectedExtraProteins.filter(p => p !== name));
    } else {
      setSelectedExtraProteins([...selectedExtraProteins, name]);
    }
  };

  const toggleExtraCheese = (name: string) => {
    if (selectedExtraCheeses.includes(name)) {
      setSelectedExtraCheeses(selectedExtraCheeses.filter(c => c !== name));
    } else {
      setSelectedExtraCheeses([...selectedExtraCheeses, name]);
    }
  };

  const handleToggleCheese = (name: string) => {
    if (name === 'Sem Queijo') {
      setSelectedCheese('Sem Queijo');
      setSelectedExtraCheeses([]);
      return;
    }

    const realCheeses = selectedCheese !== 'Sem Queijo' ? [selectedCheese, ...selectedExtraCheeses] : [];
    if (realCheeses.includes(name)) {
      const updated = realCheeses.filter(c => c !== name);
      if (updated.length > 0) {
        setSelectedCheese(updated[0]);
        setSelectedExtraCheeses(updated.slice(1));
      } else {
        setSelectedCheese('Sem Queijo');
        setSelectedExtraCheeses([]);
      }
    } else {
      if (selectedCheese === 'Sem Queijo' || !selectedCheese) {
        setSelectedCheese(name);
        setSelectedExtraCheeses([]);
      } else {
        setSelectedExtraCheeses([...selectedExtraCheeses, name]);
      }
    }
  };

  const toggleVeggie = (name: string) => {
    if (name === 'Sem Salada') {
      setSelectedVeggies(['Sem Salada']);
    } else {
      const withoutNoVeg = selectedVeggies.filter(v => v !== 'Sem Salada');
      if (withoutNoVeg.includes(name)) {
        setSelectedVeggies(withoutNoVeg.filter(v => v !== name));
      } else {
        setSelectedVeggies([...withoutNoVeg, name]);
      }
    }
  };

  const toggleSauce = (name: string) => {
    if (name === 'Sem Molho') {
      setSelectedSauces(['Sem Molho']);
    } else {
      const withoutNoSauce = selectedSauces.filter(s => s !== 'Sem Molho');
      if (withoutNoSauce.includes(name)) {
        setSelectedSauces(withoutNoSauce.filter(s => s !== name));
      } else {
        setSelectedSauces([...withoutNoSauce, name]);
      }
    }
  };

  const toggleExtra = (name: string) => {
    if (selectedExtras.includes(name)) {
      setSelectedExtras(selectedExtras.filter(e => e !== name));
    } else {
      setSelectedExtras([...selectedExtras, name]);
    }
  };

  const toggleDrink = (drinkName: string) => {
    if (selectedDrinks.includes(drinkName)) {
      setSelectedDrinks(selectedDrinks.filter(d => d !== drinkName));
    } else {
      setSelectedDrinks([...selectedDrinks, drinkName]);
    }
  };

  // Check mandatory choices
  const isBreadMissing = bagoFormat === 'sandwich' && (!selectedBread || selectedBread.trim() === '' || selectedBread === 'Sem Pão (Tigela de Salada)');
  const isVeggieMissing = selectedVeggies.length === 0;
  const isSauceMissing = selectedSauces.length === 0;

  const isFormInvalid = isBreadMissing || isVeggieMissing || isSauceMissing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBreadMissing) {
      alert('⚠️ A escolha do pão é OBRIGATÓRIA para montar o seu sanduíche!');
      return;
    }
    if (isVeggieMissing) {
      alert('⚠️ A escolha das saladas e vegetais é OBRIGATÓRIA! (Escolha as opções ou selecione "Sem Salada")');
      return;
    }
    if (isSauceMissing) {
      alert('⚠️ A escolha dos molhos artesanais é OBRIGATÓRIA! (Escolha as opções ou selecione "Sem Molho")');
      return;
    }

    const allExtras = [
      ...selectedExtras,
      ...selectedExtraProteins.map(p => `Proteína Adicional: ${p}`),
      ...selectedExtraCheeses.map(c => `Queijo Adicional: ${c}`)
    ];

    const customConfig: CustomSandwich = {
      bread: bagoFormat === 'salad' ? 'Sem Pão (Tigela de Salada)' : selectedBread,
      size: '15cm',
      protein: selectedProtein || 'Frango crocante',
      cheese: selectedCheese,
      toasted: bagoFormat === 'sandwich' ? toasted : false,
      veggies: selectedVeggies,
      sauces: selectedSauces,
      extras: allExtras,
      drinksAndCookies: selectedDrinks
    };

    const titlePrefix = bagoFormat === 'salad' ? 'Salada na Tigela' : 'Sanduíche';
    const productName = initialProduct?.name ? initialProduct.name : `${titlePrefix}: ${selectedProtein}`;

    onAddToCart({
      sandwichConfig: customConfig,
      productName,
      isReadyProduct: false,
      price: unitPrice,
      quantity,
      notes: notes.trim() ? notes.trim() : undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg max-h-[92vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Header Image with overlay control buttons */}
        <div className="relative h-44 sm:h-48 w-full bg-slate-900 overflow-hidden shrink-0">
          <img 
            src={
              bagoFormat === 'salad' 
                ? "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=80"
                : "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=1000&q=80"
            } 
            alt="Crie seu Sanduba"
            className="w-full h-full object-cover opacity-80 scale-105 transition-transform duration-500 hover:scale-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>

          {/* Top Controls */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
            <button
              type="button"
              onClick={onClose}
              className="bg-black/50 hover:bg-black/75 text-white p-2 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-lg"
              title="Voltar / Fechar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-black/50 hover:bg-black/75 text-white p-2 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-lg"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Overlay Title at bottom of banner image */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-shadow-md">
              {initialProduct?.name || selectedProtein || (bagoFormat === 'sandwich' ? 'CRIE SEU SANDUBA' : 'CRIE SUA SALADA')}
            </h2>
            <p className="text-[11px] text-slate-200 line-clamp-2 mt-0.5 font-medium leading-snug">
              {bagoFormat === 'sandwich'
                ? 'Monte o BAGÔ perfeito do seu jeito! Escolha pão fresquinho, 1 proteína, 1 queijo, até 3 saladas e 2 molhos para criar uma combinação única.'
                : 'Monte sua salada leve e nutritiva! Escolha a proteína, 1 queijo, até 5 saladas fresquinhos e 2 molhos artesanais para criar uma tigela saborosa.'
              }
            </p>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6 text-slate-800 text-xs">

          {/* 1. ESCOLHA O PÃO (Only for Sandwich) */}
          {bagoFormat === 'sandwich' && (
            <div className="space-y-2.5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                    <Wheat className="h-4 w-4 text-brand-green" />
                    <span>ESCOLHA O PÃO</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Obrigatório - Escolha 1 opção</p>
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                  selectedBread && selectedBread !== 'Sem Pão (Tigela de Salada)'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                }`}>
                  {selectedBread && selectedBread !== 'Sem Pão (Tigela de Salada)' ? '✔ Selecionado' : '⚠️ Obrigatório'}
                </span>
              </div>

              {isBreadMissing && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>Selecione uma opção de pão para prosseguir com seu sanduíche!</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {breadList.map((bread: any, idx: number) => {
                  const name = bread.name;
                  const priceAdd = bread.price || 0;
                  const isSelected = selectedBread === name;

                  return (
                    <button
                      key={`bread-${idx}`}
                      type="button"
                      onClick={() => setSelectedBread(name)}
                      className={`w-full p-3 flex justify-between items-center text-left transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-50/80 font-bold text-slate-900' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold block">{name}</span>
                        <span className="text-[10px] text-slate-400 block font-normal">Assado diariamente no forno</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 px-2 py-0.5 rounded-md uppercase tracking-wide">
                          Incluso
                        </span>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. ESCOLHA UMA (1) PROTEÍNA */}
          {(() => {
            const defaultProteinName = initialProduct?.sandwichConfig?.protein || initialProduct?.name || '';

            return (
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-brand-green" />
                      <span>ESCOLHA UMA (1) PROTEÍNA</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Recheio principal do produto</p>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
                    {selectedProtein ? `✔ ${selectedProtein}` : 'Escolha 1'}
                  </span>
                </div>

                {/* Recheio Padrão Cadastrado em Produtos Prontos */}
                {defaultProteinName ? (
                  <div className="bg-amber-50/90 border border-amber-200/90 p-3 rounded-2xl space-y-2 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                        ⭐ Recheio Padrão (Cadastrado)
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                        Incluso no valor
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedProtein(defaultProteinName)}
                      className={`w-full p-3 rounded-xl border-2 flex justify-between items-center text-left transition-all cursor-pointer ${
                        selectedProtein === defaultProteinName
                          ? 'bg-white border-brand-green font-bold text-slate-900 shadow-xs ring-2 ring-brand-green/20'
                          : 'bg-white/80 border-slate-200 hover:bg-white text-slate-700'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black block text-slate-900">{defaultProteinName}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {initialProduct?.name ? `Recheio oficial do ${initialProduct.name}` : 'Recheio padrão incluso'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-emerald-700">Incluso (R$ 0,00)</span>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          selectedProtein === defaultProteinName ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {selectedProtein === defaultProteinName && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  </div>
                ) : null}

                {/* ESCOLHA PROTEÍNA ADICIONAIS / OUTRAS PROTEÍNAS */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center px-0.5">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                      <span>Escolha Proteína Adicionais:</span>
                    </span>
                    <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md">
                      {selectedExtraProteins.length > 0 
                        ? `${selectedExtraProteins.length} adicional(is) (+R$ ${(selectedExtraProteins.reduce((acc, name) => {
                            const p = proteinList.find((x: any) => x.name === name);
                            return acc + (Number(p?.price) || 14.00);
                          }, 0) || 0).toFixed(2).replace('.', ',')})`
                        : 'Soma ao valor total'
                      }
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    {proteinList.map((prot: any, idx: number) => {
                      const name = prot.name;
                      const priceVal = Number(prot.price) || 14.00;
                      const isExtraSelected = selectedExtraProteins.includes(name);

                      return (
                        <button
                          key={`extra-prot-${idx}`}
                          type="button"
                          onClick={() => toggleExtraProtein(name)}
                          className={`w-full p-3 flex justify-between items-center text-left transition-all cursor-pointer ${
                            isExtraSelected 
                              ? 'bg-emerald-50/80 font-bold text-slate-900 ring-1 ring-emerald-500/20' 
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold block">{name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-emerald-700">
                              +R$ {(Number(priceVal) || 0).toFixed(2).replace('.', ',')}
                            </span>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              isExtraSelected ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isExtraSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3. ESCOLHA O QUEIJO */}
          {(() => {
            const defaultCheeseName = initialProduct?.sandwichConfig?.cheese || (selectedCheese !== 'Sem Queijo' ? selectedCheese : (cheeseList[0]?.name || 'Mussarela'));
            const isNoCheeseSelected = selectedCheese === 'Sem Queijo';

            return (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                      <span>🧀 ESCOLHA O QUEIJO</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Queijo padrão incluso + 1 opção adicional gratuita
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                      !isNoCheeseSelected || selectedExtraCheeses.length > 0
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}>
                      {!isNoCheeseSelected
                        ? (selectedExtraCheeses.length > 0 
                            ? `✔ ${selectedCheese} + ${selectedExtraCheeses.length} extra` 
                            : `✔ ${selectedCheese}`)
                        : (selectedExtraCheeses.length > 0
                            ? `✔ ${selectedExtraCheeses.length} extra(s)`
                            : 'Sem Queijo')
                      }
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isNoCheeseSelected && selectedExtraCheeses.length === 0) {
                          setSelectedCheese(defaultCheeseName || 'Mussarela');
                        } else {
                          setSelectedCheese('Sem Queijo');
                          setSelectedExtraCheeses([]);
                        }
                      }}
                      className={`px-2 py-1 font-bold rounded-lg text-[11px] transition-all cursor-pointer ${
                        isNoCheeseSelected && selectedExtraCheeses.length === 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isNoCheeseSelected && selectedExtraCheeses.length === 0 ? '🧀 Adicionar Queijo' : '🧹 Sem Queijo'}
                    </button>
                  </div>
                </div>

                {/* Queijo Padrão Cadastrado */}
                {!isNoCheeseSelected && defaultCheeseName && defaultCheeseName !== 'Sem Queijo' ? (
                  <div className="bg-amber-50/90 border border-amber-200/90 p-3 rounded-2xl space-y-2 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                        ⭐ Queijo Padrão (Cadastrado)
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                        Incluso no valor
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCheese(defaultCheeseName)}
                      className={`w-full p-3 rounded-xl border-2 flex justify-between items-center text-left transition-all cursor-pointer ${
                        selectedCheese === defaultCheeseName
                          ? 'bg-white border-brand-green font-bold text-slate-900 shadow-xs ring-2 ring-brand-green/20'
                          : 'bg-white/80 border-slate-200 hover:bg-white text-slate-700'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black block text-slate-900">{defaultCheeseName}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          Queijo oficial incluso sem custo
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-emerald-700">Incluso (R$ 0,00)</span>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          selectedCheese === defaultCheeseName ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {selectedCheese === defaultCheeseName && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  </div>
                ) : null}

                {/* ESCOLHA QUEIJO ADICIONAIS */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center px-0.5">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                      <span>Escolha Queijo Adicionais:</span>
                    </span>
                    <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md">
                      1º adicional incluso sem custo
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    {cheeseList
                      .filter((c: any) => c.name !== 'Sem Queijo')
                      .map((cheese: any, idx: number) => {
                        const name = cheese.name;
                        const isExtraSelected = selectedExtraCheeses.includes(name);
                        const indexInExtra = selectedExtraCheeses.indexOf(name);

                        const foundCheese = ingredients.find(i => i.category === 'cheese' && i.name === name);
                        const itemPrice = (foundCheese && typeof foundCheese.price === 'number' && foundCheese.price > 0) 
                          ? foundCheese.price 
                          : (Number(cheese.price) || 3.50);
                        const priceFormatted = `+R$ ${itemPrice.toFixed(2).replace('.', ',')}`;

                        let priceLabel = '';
                        let priceClass = '';

                        if (isExtraSelected) {
                          if (indexInExtra === 0) {
                            priceLabel = 'Incluso';
                            priceClass = 'text-slate-500 font-medium';
                          } else {
                            priceLabel = priceFormatted;
                            priceClass = 'text-emerald-700 font-black';
                          }
                        } else {
                          if (selectedExtraCheeses.length === 0) {
                            priceLabel = 'Incluso';
                            priceClass = 'text-slate-400 font-medium';
                          } else {
                            priceLabel = priceFormatted;
                            priceClass = 'text-emerald-700 font-black';
                          }
                        }

                        return (
                          <button
                            key={`extra-cheese-${idx}`}
                            type="button"
                            onClick={() => toggleExtraCheese(name)}
                            className={`w-full p-3 flex justify-between items-center text-left transition-all cursor-pointer ${
                              isExtraSelected 
                                ? 'bg-emerald-50/80 font-bold text-slate-900 ring-1 ring-emerald-500/20' 
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">{name}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[11px] ${priceClass}`}>
                                {priceLabel}
                              </span>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                isExtraSelected ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {isExtraSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 4. SALADAS E VEGETAIS */}
          {(() => {
            const maxFreeVeggies = bagoFormat === 'salad' ? 5 : 3;

            return (
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                      <span>🥗 SALADAS E VEGETAIS</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Obrigatório - Escolha pelo menos 1 opção (ou Sem Salada)
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                      selectedVeggies.length > 0 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                    }`}>
                      {selectedVeggies.length > 0 
                        ? (selectedVeggies.includes('Sem Salada') ? '✔ Sem Salada' : `✔ ${selectedVeggies.length} Selecionada(s)`) 
                        : '⚠️ Obrigatório'
                      }
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedVeggies(['Sem Salada'])}
                      className={`px-2 py-1 font-bold rounded-lg text-[11px] transition-all cursor-pointer ${
                        selectedVeggies.includes('Sem Salada')
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      🧹 Sem Salada
                    </button>
                  </div>
                </div>

                {isVeggieMissing && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>Selecione as saladas/vegetais desejados (ou clique em "Sem Salada") para prosseguir!</span>
                  </div>
                )}

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  {veggieList.map((veg: string, idx: number) => {
                    const isSelected = selectedVeggies.includes(veg);
                    const realSelectedVeggies = selectedVeggies.filter(v => v !== 'Sem Salada');
                    const indexInSelected = realSelectedVeggies.indexOf(veg);
                    
                    const foundVeg = ingredients.find(i => i.category === 'vegetable' && i.name === veg);
                    const itemPrice = (foundVeg && typeof foundVeg.price === 'number' && foundVeg.price > 0) ? foundVeg.price : 1.50;
                    const priceFormatted = `+R$ ${itemPrice.toFixed(2).replace('.', ',')}`;

                    let priceLabel = '';
                    let priceClass = '';

                    if (veg === 'Sem Salada') {
                      priceLabel = 'Incluso';
                      priceClass = 'text-slate-400 font-medium';
                    } else if (isSelected) {
                      if (indexInSelected < maxFreeVeggies) {
                        priceLabel = 'Incluso';
                        priceClass = 'text-slate-500 font-medium';
                      } else {
                        priceLabel = priceFormatted;
                        priceClass = 'text-emerald-700 font-black';
                      }
                    } else {
                      if (realSelectedVeggies.length < maxFreeVeggies) {
                        priceLabel = 'Incluso';
                        priceClass = 'text-slate-400 font-medium';
                      } else {
                        priceLabel = priceFormatted;
                        priceClass = 'text-emerald-700 font-black';
                      }
                    }

                    return (
                      <button
                        key={`veg-${idx}`}
                        type="button"
                        onClick={() => toggleVeggie(veg)}
                        className={`w-full p-3 flex justify-between items-center text-left transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-emerald-50/80 font-bold text-slate-900' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-semibold">{veg}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-[11px] ${priceClass}`}>
                            {priceLabel}
                          </span>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 5. MOLHOS ARTESANAIS */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                  <span>🥣 MOLHOS ARTESANAIS</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Obrigatório - Escolha pelo menos 1 opção (ou Sem Molho)
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                  selectedSauces.length > 0 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                }`}>
                  {selectedSauces.length > 0 
                    ? (selectedSauces.includes('Sem Molho') ? '✔ Sem Molho' : `✔ ${selectedSauces.length} Selecionado(s)`) 
                    : '⚠️ Obrigatório'
                  }
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSauces(['Sem Molho'])}
                  className={`px-2 py-1 font-bold rounded-lg text-[11px] transition-all cursor-pointer ${
                    selectedSauces.includes('Sem Molho')
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  🧹 Sem Molho
                </button>
              </div>
            </div>

            {isSauceMissing && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>Selecione os molhos artesanais desejados (ou a opção "Sem Molho") para prosseguir!</span>
              </div>
            )}

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {sauceList.map((sauce: string, idx: number) => {
                const isSelected = selectedSauces.includes(sauce);
                const realSelectedSauces = selectedSauces.filter(s => s !== 'Sem Molho');
                const indexInSelected = realSelectedSauces.indexOf(sauce);

                const foundSauce = ingredients.find(i => i.category === 'sauce' && i.name === sauce);
                const itemPrice = (foundSauce && typeof foundSauce.price === 'number' && foundSauce.price > 0) ? foundSauce.price : 1.50;
                const priceFormatted = `+R$ ${itemPrice.toFixed(2).replace('.', ',')}`;

                let priceLabel = '';
                let priceClass = '';

                if (sauce === 'Sem Molho') {
                  priceLabel = 'Incluso';
                  priceClass = 'text-slate-400 font-medium';
                } else if (isSelected) {
                  if (indexInSelected < 2) {
                    priceLabel = 'Incluso';
                    priceClass = 'text-slate-500 font-medium';
                  } else {
                    priceLabel = priceFormatted;
                    priceClass = 'text-emerald-700 font-black';
                  }
                } else {
                  if (realSelectedSauces.length < 2) {
                    priceLabel = 'Incluso';
                    priceClass = 'text-slate-400 font-medium';
                  } else {
                    priceLabel = priceFormatted;
                    priceClass = 'text-emerald-700 font-black';
                  }
                }

                return (
                  <button
                    key={`sauce-${idx}`}
                    type="button"
                    onClick={() => toggleSauce(sauce)}
                    className={`w-full p-3 flex justify-between items-center text-left transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-amber-50/80 font-bold text-slate-900' 
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-semibold">{sauce}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] ${priceClass}`}>
                        {priceLabel}
                      </span>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8. OBSERVAÇÕES DO PEDIDO */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase block">Observações do Item:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Molho à parte, bem tostado, caprichar no tomate..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
            />
          </div>

          {/* 9. BEBIDAS E ACOMPANHAMENTOS (OPCIONAL) */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                  <Coffee className="h-4 w-4 text-brand-green" />
                  <span>🥤 ADICIONAR BEBIDAS (OPCIONAL)</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Escolha refrigerante, suco natural ou vitamina para acompanhar seu pedido
                </p>
              </div>
              {selectedDrinks.length > 0 && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
                  ✔ {selectedDrinks.length} selecionada(s)
                </span>
              )}
            </div>

            {/* A. Refrigerantes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <span>🥤 Refrigerantes & Águas:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Lata / Garrafa</span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {refrigerantesList.map((item, idx) => {
                  const name = item.name;
                  const isSelected = selectedDrinks.includes(name);
                  const foundReady = readyProducts.find(p => p.name.toLowerCase() === name.toLowerCase());
                  const foundIng = ingredients.find(i => i.name.toLowerCase() === name.toLowerCase());
                  const priceVal = (foundReady && typeof foundReady.price === 'number')
                    ? foundReady.price 
                    : (foundIng && typeof foundIng.price === 'number')
                      ? foundIng.price
                      : item.price;

                  return (
                    <button
                      key={`refri-${idx}`}
                      type="button"
                      onClick={() => toggleDrink(name)}
                      className={`w-full p-3 flex justify-between items-center text-left transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-50/80 font-bold text-slate-900 ring-1 ring-emerald-500/20' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-xs font-semibold">{name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-emerald-700">
                          +R$ {priceVal.toFixed(2).replace('.', ',')}
                        </span>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* B. Sucos 330ml ou 500ml */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <span>🍹 Sucos Naturais (330ml ou 500ml):</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Feito na hora</span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {sucosList.map((item, idx) => {
                  const name = item.name;
                  const isSelected = selectedDrinks.includes(name);
                  const foundReady = readyProducts.find(p => p.name.toLowerCase() === name.toLowerCase());
                  const foundIng = ingredients.find(i => i.name.toLowerCase() === name.toLowerCase());
                  const priceVal = (foundReady && typeof foundReady.price === 'number')
                    ? foundReady.price 
                    : (foundIng && typeof foundIng.price === 'number')
                      ? foundIng.price
                      : item.price;

                  return (
                    <button
                      key={`suco-${idx}`}
                      type="button"
                      onClick={() => toggleDrink(name)}
                      className={`w-full p-3 flex justify-between items-center text-left transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-50/80 font-bold text-slate-900 ring-1 ring-emerald-500/20' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-xs font-semibold">{name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-emerald-700">
                          +R$ {priceVal.toFixed(2).replace('.', ',')}
                        </span>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* C. Vitaminas 330ml ou 500ml */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <span>🥛 Vitaminas Cremosas (330ml ou 500ml):</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Nutritivo e Cremoso</span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {vitaminasList.map((item, idx) => {
                  const name = item.name;
                  const isSelected = selectedDrinks.includes(name);
                  const foundReady = readyProducts.find(p => p.name.toLowerCase() === name.toLowerCase());
                  const foundIng = ingredients.find(i => i.name.toLowerCase() === name.toLowerCase());
                  const priceVal = (foundReady && typeof foundReady.price === 'number')
                    ? foundReady.price 
                    : (foundIng && typeof foundIng.price === 'number')
                      ? foundIng.price
                      : item.price;

                  return (
                    <button
                      key={`vitamina-${idx}`}
                      type="button"
                      onClick={() => toggleDrink(name)}
                      className={`w-full p-3 flex justify-between items-center text-left transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-50/80 font-bold text-slate-900 ring-1 ring-emerald-500/20' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-xs font-semibold">{name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-emerald-700">
                          +R$ {priceVal.toFixed(2).replace('.', ',')}
                        </span>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-brand-green border-brand-green text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </form>

        {/* Sticky Fixed Bottom Bar - Matching Image Exactly */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-xl space-y-3 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Valor Total</span>
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                R$ {(Number(totalPrice) || 0).toFixed(2).replace('.', ',')}
              </span>
            </div>

            {/* Quantity Selector Pill Group matching screenshot */}
            <div className="bg-slate-900 text-white rounded-full p-1 flex items-center gap-3 px-3 shadow-md">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer font-extrabold text-lg"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-extrabold text-base min-w-[20px] text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer font-extrabold text-lg"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isFormInvalid}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
              isFormInvalid
                ? 'bg-rose-500 text-white opacity-90 cursor-not-allowed animate-pulse'
                : 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20'
            }`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span>
              {isBreadMissing
                ? '⚠️ ESCOLHA O PÃO DO SANDUÍCHE'
                : isVeggieMissing
                ? '⚠️ ESCOLHA AS SALADAS / VEGETAIS'
                : isSauceMissing
                ? '⚠️ ESCOLHA OS MOLHOS ARTESANAIS'
                : (isPos ? 'ADICIONAR AO PEDIDO (PDV)' : 'ADICIONAR AO CARRINHO')}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
