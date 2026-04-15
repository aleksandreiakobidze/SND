/**
 * Cross-domain suggested questions.
 * Returns domain-crossing follow-up suggestions based on the last agent response.
 */

import type { AgentDomain } from "@/lib/agents/agent-base";

interface CrossDomainSuggestion {
  fromDomain: AgentDomain;
  question: string;
  questionKa: string;
}

const CROSS_SUGGESTIONS: CrossDomainSuggestion[] = [
  {
    fromDomain: "sales",
    question: "Show margin breakdown for the top products by revenue",
    questionKa: "აჩვენე მარჟის ანალიზი ტოპ პროდუქტებისთვის შემოსავლის მიხედვით",
  },
  {
    fromDomain: "sales",
    question: "Compare current stock vs last month's sales velocity",
    questionKa: "შეადარე მიმდინარე მარაგი გასული თვის გაყიდვების სიჩქარეს",
  },
  {
    fromDomain: "sales",
    question: "What is the average discount impact on revenue by region?",
    questionKa: "რა არის ფასდაკლების გავლენა შემოსავალზე რეგიონების მიხედვით?",
  },
  {
    fromDomain: "pricing",
    question: "Show sales volume for products with highest discount depth",
    questionKa: "აჩვენე გაყიდვების მოცულობა ყველაზე მაღალი ფასდაკლების პროდუქტებისთვის",
  },
  {
    fromDomain: "pricing",
    question: "Compare purchase cost vs selling price by brand",
    questionKa: "შეადარე შესყიდვის ფასი გასაყიდ ფასს ბრენდების მიხედვით",
  },
  {
    fromDomain: "purchase",
    question: "Compare purchase cost trend vs selling price trend",
    questionKa: "შეადარე შესყიდვის ფასის ტრენდი გასაყიდ ფასის ტრენდს",
  },
  {
    fromDomain: "purchase",
    question: "Which purchased products have the best sales turnover?",
    questionKa: "რომელ შესყიდულ პროდუქტებს აქვთ საუკეთესო გაყიდვების ბრუნვა?",
  },
  {
    fromDomain: "inventory",
    question: "Show products below safety stock with their sales velocity",
    questionKa: "აჩვენე პროდუქტები მინიმუმ მარაგზე ქვემოთ მათი გაყიდვების სიჩქარით",
  },
  {
    fromDomain: "inventory",
    question: "Which warehouses need restocking based on purchase patterns?",
    questionKa: "რომელ საწყობებს სჭირდებათ შევსება შესყიდვის პატერნების მიხედვით?",
  },
  {
    fromDomain: "online",
    question: "Show pricing details for products in today's field orders",
    questionKa: "აჩვენე დღევანდელი საველე შეკვეთების პროდუქტების ფასების დეტალები",
  },
];

export function getCrossDomainSuggestions(
  fromDomain: AgentDomain,
  locale: "en" | "ka",
  limit: number = 3,
): string[] {
  return CROSS_SUGGESTIONS
    .filter((s) => s.fromDomain === fromDomain)
    .slice(0, limit)
    .map((s) => (locale === "ka" ? s.questionKa : s.question));
}
