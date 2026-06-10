Feature: Delete todo
  As a user
  I want to delete todos with confirmation
  So that I do not remove tasks by accident

  Background:
    Given I am on the todo application page

  Scenario: Delete todo with confirmation
    Given a todo exists with title "Old task"
    When I delete the todo "Old task" and confirm
    Then I should not see a todo with title "Old task"

  Scenario: Cancel delete action
    Given a todo exists with title "Keep task"
    When I delete the todo "Keep task" and cancel
    Then I should see a todo with title "Keep task"
