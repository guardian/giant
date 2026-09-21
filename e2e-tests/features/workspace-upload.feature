Feature: Upload a file to a workspace
  Users can upload a document to a workspace and have Giant process it.

  Scenario: Upload a PDF to a new workspace and complete extraction
    Given I open workspaces in a fresh browser session
    When I log in as "genesis-e2e" with password "Genesis-e2e-password"
    And I create a new workspace named "Toast sandwich"
    And I upload "toast_sandwich_en_wiki.pdf" to the workspace
    Then file "toast_sandwich_en_wiki.pdf" is successfully processed in the workspace
