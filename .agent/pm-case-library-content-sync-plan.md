# 📋 Implementation Plan: Synchronize Case Library Content

> **Objective**: Align the "Featured Cases" section in `index.html` with the visual references provided by the user (Images 2 & 3), ensuring titles and case cards match the "Manager Case Library" content.

## 1. 🔍 Discrepancy Analysis (差异分析)

| Feature          | Current State (`index.html`)              | Target State (User Images)                                |
| :--------------- | :---------------------------------------- | :-------------------------------------------------------- |
| **Tab 1 Title**  | 🌍 跨文化管理 (Cross-cultural Management) | 跨文化管理案例库 (Cross-cultural Management Case Library) |
| **Tab 2 Title**  | 👔 管理者智慧 (Manager's Wisdom)          | 管理者案例库 (Manager Case Library)                       |
| **Icons**        | 🌍 / 👔                                   | Default / Consistent icons                                |
| **Case Content** | Generic/Old placeholders                  | Specific cases from Image 3 (e.g., M01-M06)               |

## 2. 📝 Content Mapping (内容映射)

Based on Image 3 `https://coriaxu.github.io/surfin-case-library/`, we will update the `case-panel-manager` section with the following 4 cards (matching the Grid layout):

### Card 1: 从超级 PM 到指挥官的转型之路

_(Ref: Image 1, First Card)_

- **Icon**: 👔 (or keeping existing suit icon)
- **Title**: 从超级 PM 到指挥官的转型之路
- **Dilemma**: "管理者两难：自己干还是放手？如何把个人能力复制给团队"

### Card 2: 如何高效布置工作 (CASE M01)

- **Icon**: 📋 (Clipboard)
- **Title**: 如何高效布置工作
- **Dilemma**: "管理者两难：交代还是盯人？任务布置后效果差，如何解决"
- _(Note: Image 3 content "意愿三角..." is the desc, but we'll adapt to the "Dilemma" format or use the desc if fits)_

### Card 3: 把批评变成建设性冲突 (CASE M02)

- **Icon**: 💬 (Speech Bubble)
- **Title**: 把批评变成建设性冲突
- **Dilemma**: "管理者两难：避冲突还是直怼？如何让批评真正有效"

### Card 4: 批评员工：把“避责”变成“对齐” (CASE M03)

- **Icon**: 🎯 (Target)
- **Title**: 批评员工：把“避责”变成“对齐”
- **Dilemma**: "管理者两难：不查=失控，猛批=堵心，如何建立正向循环"

## 3. 🛠️ Execution Steps (执行步骤)

1.  **Update Tab Headers**:

    - Change "🌍 跨文化管理" -> "跨文化管理案例库"
    - Change "👔 管理者智慧" -> "管理者案例库"
    - (Remove emojis from text if they are not in the design, but Image 1 shows emojis might be okay, actually Image 2 shows "跨文化管理案例库" inside a dark pill shape, but Image 1 shows standard tabs. I will stick to the _text_ request: "跟图 2 对应上" -> "跨文化管理案例库", "管理者案例库").

2.  **Update Manager Case Panel**:
    - Replace existing content in `#case-panel-manager` with the 4 cards identified above.
    - Ensure "Dilemma" (Two-fold difficulty) text is punchy and accurate to the card's theme.

## 4. ✅ Verification

- Check if the Tab names match Image 2.
- Check if the 4 cards in "Manager Case Library" match the user's expectation (Image 1/3).
