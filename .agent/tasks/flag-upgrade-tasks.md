# 🏁 Task Checklist: National Flag Visual Upgrade (3D Premium)

> **Objective**: Replace standard Emoji flags with high-fidelity 3D textured flag icons to enhance the premium visual experience of the Surfin L&D System.
> **Selected Scheme**: Scheme A (3D Texture / The Diplomat)

## 📦 Phase 1: Asset Acquisition

- [ ] **Task 1.1**: Identify and source high-quality 3D PNG flag assets for:
  - 🇮🇩 Indonesia
  - 🇰🇪 Kenya
  - 🇳🇬 Nigeria
  - _Note_: Assets should be > 128x128px, transparent background, with "wavy cloth" or "glossy button" effect.
- [ ] **Task 1.2**: Create directory `assets/flags` and save the images there.
  - `assets/flags/indonesia.png`
  - `assets/flags/kenya.png`
  - `assets/flags/nigeria.png`

## 🎨 Phase 2: Implementation & Integration

- [ ] **Task 2.1**: Modify `index.html` to update the "National Playbook" (国家手册) section.
  - Replace Emoji characters in specific `case-playbook-name-en` or `case-stat-icon` divs with `<img>` tags.
- [ ] **Task 2.2**: Add CSS styles in `index.html` (or separate CSS file if applicable) for the new flag icons.
  - Class: `.flag-3d`
  - Style: Height ~24px-32px, drop shadow, smooth rendering.

## 💅 Phase 3: Visual Polish & Verification

- [x] **Task 3.1**: Adjust vertical alignment to ensure flags sit perfectly next to text.
- [x] **Task 3.2**: Check responsiveness (ensure they don't look huge on mobile).
- [x] **Task 3.3**: Final review (User Confirmation).
