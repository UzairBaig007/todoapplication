Feature: Clear completed tasks
  As a user
  I want to clear all completed todos
  So that my list stays focused on active work

  Background:
    Given I am on the todo application page

  Scenario: Clear all completed tasks with confirmation
    Given a todo exists with title "Done task" and status "Done"
    And a todo exists with title "Active task" and status "Pending"
    When I clear all completed tasks and confirm
    Then I should not see a todo with title "Done task"
    And I should see a todo with title "Active task"

  Scenario: Clear completed button is hidden when no done tasks
    Given a todo exists with title "Only pending" and status "Pending"
    Then the clear completed button should not be visible
