# PhotoForge Studio

Nowoczesny prototyp edytora zdjęć w React + TypeScript, przeznaczony do uruchomienia w VS Code Web / środowisku z terminalem.

## Uruchomienie

W terminalu projektu:

```bash
npm install
npm run dev
```

Otwórz adres wyświetlony przez Vite. W VS Code Web użyj port forwarding dla portu 5173, jeśli środowisko tego wymaga.

## Funkcje prototypu

- Import obrazu z komputera
- Podgląd zdjęcia na płótnie i zoom
- Korekty jasności, kontrastu, nasycenia, temperatury, odcienia, skali szarości i rozmycia
- Presety kolorystyczne
- Panel warstw: widoczność, krycie, zmiana kolejności
- Dodawanie i edycja tekstu oraz prostokątów
- Cofnij / ponów korekty
- Eksport do PNG
- Responsywny, ciemny interfejs

## Ograniczenia prototypu

To rozbudowywalna baza, a nie pełny odpowiednik Photoshopa. Narzędzie kadrowania i pędzel są na tym etapie elementami interfejsu/podglądu; pełne maski, selekcje, zaznaczenia, historia pikselowa, RAW i zgodność PSD wymagają osobnych modułów. Eksport PNG obsługuje obraz bazowy, podstawowe filtry i warstwy tekstowe; zaawansowany compositing warstw jest kolejnym etapem rozwoju.

## Stack

- React + TypeScript
- Vite
- Konva + React Konva
- Lucide React
- Tailwind CSS

W `package.json` zależności używają `latest`, aby instalacja pobierała aktualne wydania dostępne w rejestrze npm. W projektach produkcyjnych zalecane jest zapisanie i utrzymywanie przetestowanych wersji w lockfile.
