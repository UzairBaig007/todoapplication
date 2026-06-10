Feature: Edit todo
  As a user
  I want to edit todo titles and notes
  So that I can keep task details up to date

  Background:
    Given I am on the todo application page

  Scenario: Edit todo title
    Given a todo exists with title "Draft email"
    When I edit the todo "Draft email" title to "Send email"
    Then I should see a todo with title "Send email"
    And I should not see a todo with title "Draft email"

  Scenario: Edit todo note
    Given a todo exists with title "Call client" and note "Morning"
    When I edit the todo "Call client" note to "Afternoon slot"
    Then the todo "Call client" should display note "Afternoon slot"

  Scenario: Cancel editing does not save changes
    Given a todo exists with title "Read docs"
    When I open edit for "Read docs" and cancel without saving
    Then I should see a todo with title "Read docs"

  Scenario: Cannot save todo with empty title
    Given a todo exists with title "Valid task"
    When I try to save an empty title for "Valid task"
    Then I should see an error "Title cannot be empty"
    And I should see a todo with title "Valid task"
