Feature: Extract uploaded files using transcription-service
  Giant sends audio and OCR jobs to the external worker and receives their results.

  Scenario: Upload audio and complete external transcription
    Given I open workspaces using the existing session
    When I create a new workspace named "Audio transcription"
    And I upload "sample.wav" to the workspace
    Then file "sample.wav" is successfully processed in the workspace
    And file "sample.wav" has a non-empty transcript

  Scenario: Upload a PDF and complete external OCR extraction
    Given I open workspaces using the existing session
    When I create a new workspace named "Life's a Riot external OCR"
    And I upload "lifes_a_riot_with_spy_vs_spy_en.pdf" to the workspace
    Then file "lifes_a_riot_with_spy_vs_spy_en.pdf" is successfully processed in the workspace

  Scenario: Upload an image and complete external OCR extraction
    Given I open workspaces using the existing session
    When I create a new workspace named "Image external OCR"
    And I upload "for_the_many.png" to the workspace
    Then file "for_the_many.png" is successfully processed in the workspace
    And file "for_the_many.png" has OCR output containing "for the many"
