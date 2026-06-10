Feature: Add todo
  As a user
  I want to add todos with optional notes
  So that I can track my tasks

  Scenario: Add a todo without a note
    Given I am on the todo application page
    When I add a todo with title "Buy groceries"
    Then I should see a todo with title "Buy groceries"
    And the todo "Buy groceries" should not display a note

  Scenario: Add a todo with a note
    Given I am on the todo application page
    When I add a todo with title "Team meeting" and note "Prepare agenda"
    Then I should see a todo with title "Team meeting"
    And the todo "Team meeting" should display note "Prepare agenda"
