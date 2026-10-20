# FINAURA labelling rubric (category boundaries + Need/Want/Investment)

Single source of truth for human labels (data/human_labels.csv, evaluation/challenge_v4.csv) and for the LLM
prompts in classifier/generate_llm_dataset.py, which embed the rules below verbatim.

## Category boundaries
- Prepared food or drinks bought ready to eat (restaurants, cafes, delivery, sweet shops, bakeries, ice cream, desserts) -> Food & Dining.
- Raw ingredients, staples, dairy, fruit, vegetables, packaged food and household supplies for home -> Groceries.
- Bars, pubs, breweries, nightclubs, alcohol, cigarettes, parties, events, games, OTT, movies -> Entertainment.
- Fuel, EV charging, tolls, FASTag, parking, vehicle service/repair/parts/accessories, all tickets, cabs, hotels -> Transport & Travel.
- Rent, deposits, brokerage, society charges, property/house tax, garbage fee, home repairs and services, domestic staff salary -> Housing.
- Electricity, water, sewage, gas, phone, internet, DTH, newspapers, cloud storage and software/SaaS/AI-tool subscriptions -> Utilities & Bills.
- Any EMI, loan repayment, credit card bill, BNPL/pay-later dues (even for a product purchase) -> Debt & Loan Payments.
- Clothes, footwear, electronics, gadgets, furniture, decor, jewellery, watches, toys, gifts, general stationery -> Shopping.
- Doctors, hospitals, pharmacies, medicines, diagnostics, therapy, medical devices, gyms, fitness, yoga, supplements -> Health.
- Fees, courses, coaching, exams, certifications, lessons for any skill (music, sport, language), study books and supplies -> Education.
- Salons, barbers, spa, cosmetics, skincare, toiletries, grooming products and appliances -> Personal Care.
- Any insurer premium, including LIC, ULIP, endowment and annuity plans -> Insurance.
- Stocks, mutual funds, SIPs, ETFs, bonds, FD, RD, PPF, NPS, EPF/VPF, gold bonds, digital gold, demat charges -> Investments.
- Transfers to people, cash withdrawal, bank charges, fines/challans, government and legal fees, courier/post,
  donations, tips, repairs of personal items (tailor, cobbler, watch, keys), unknown merchants -> Misc.

## Type rules
- Housing, Utilities & Bills, Debt & Loan Payments, Insurance: always Need. Entertainment: always Want. Investments: always Investment.
- Food & Dining: Want; Need only for office canteen, hostel mess or tiffin service.
- Groceries: Need; Want only for snacks and treats (chips, biscuits, chocolates, sweets, dry fruits, instant noodles).
- Transport & Travel: Need for fuel, EV charging, tolls, parking, metro, local bus/train, auto rickshaw, vehicle service and repair;
  Want for app cabs, intercity or long-distance tickets, flights, hotels, holidays, car wash and accessories.
- Shopping: Want; Need for essentials (school uniform, spectacles, rain gear, replacement work chargers).
- Health: Need; Want for gym, fitness classes, yoga and protein/fitness supplements.
- Education: Need for school-level costs (school fees, school books, kids' stationery, school van, home tuition for a child);
  Investment for everything an adult does to build skills or qualifications (college, degrees, coaching, courses, exams, certifications, lessons).
- Personal Care: Want; Need for basic hygiene (soap, toothpaste, shampoo, razor, sanitary products).
- Misc: Need; Want only for donations, tips and gifts of money.
