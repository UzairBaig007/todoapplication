Feature: Todo status
  As a user
  I want to change todo status
  So that I can track progress

  Background:
    Given I am on the todo application page

  Scenario: Change status to in progress
    Given a todo exists with title "Write tests"
    When I change the status of "Write tests" to "In progress"
    Then the todo "Write tests" should have status "In progress"

  Scenario: Mark todo as done with confirmation
    Given a todo exists with title "Ship release"
    When I change the status of "Ship release" to "Done" and confirm
    Then the todo "Ship release" should have status "Done"

  Scenario: Cancel marking todo as done
    Given a todo exists with title "Review PR"
    When I change the status of "Review PR" to "Done" and cancel
    Then the todo "Review PR" should have status "Pending"
