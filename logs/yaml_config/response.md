It looks like I need write permission to modify the file. Could you approve the edit? I'm splitting `ecosystem_diversity` (6 indicators) into two dimensions to reach the required 15:

- **ecosystem_diversity** (3): natural_habitat_area, habitat_connectivity, wildlife_corridors
- **functional_biodiversity** (3): pollinator_presence, beneficial_insect_habitat, agroforestry_integration

The service object at `app/services/questionnaire_config.rb` is already complete and structure-agnostic — it will automatically pick up the 15th dimension from the YAML without any code changes.
