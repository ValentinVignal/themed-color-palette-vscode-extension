# Change Log

### [0.1.0] - 2023-07-31
- Adds support of theme import from another theme.

### [0.0.8] - 2022-05-06
- Fix bug when there are more than 3 themes and the extension was crashing.

### [0.0.7] - 2022-04-04
- Correctly reuse the non-imported value of the default theme for unspecified themes.

### [0.0.6] - 2022-04-03

- Support shared values.
- Validate the imports.
- Add lints for imports and values given to `withOpacity` key.
- Consider `withOpacity` parameter for the decorations.
- For themed colors, add a box decoration for each theme after the item.

### [0.0.4] - 2022-03-31

- Properly lint the value (`dark`, `light`) of the themed brightness object.
- Fix bug where hardcoded color had missing/duplicated decoration(s).

### [0.0.3] - 2022-03-31

- Fix the JSON Schema to support `value` keyword (with potential `withOpacity`) for colors.
- Display the color decoration for the hardcoded colors.

### [0.0.1] - 2022-03-29

Initial release of the extension.
- Provides the JSON Schema.
- Lints, themed object that don't specify the default theme.
