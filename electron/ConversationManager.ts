/**
 * ConversationManager - Manages conversation state and messages
 * Follows Single Responsibility Principle - only handles conversation state
 * Uses EventEmitter for loose coupling (Observer pattern)
 */
import { EventEmitter } from 'events';

export interface ConversationMessage {
  id: string;
  speaker: 'interviewer' | 'interviewee';
  text: string;
  timestamp: number;
  edited?: boolean;
}

export interface IConversationManager {
  addMessage(text: string, speaker?: 'interviewer' | 'interviewee'): ConversationMessage;
  toggleSpeaker(): 'interviewer' | 'interviewee';
  getCurrentSpeaker(): 'interviewer' | 'interviewee';
  getMessages(): ConversationMessage[];
  getConversationHistory(): string;
  getIntervieweeAnswers(): string[];
  updateMessage(messageId: string, newText: string): boolean;
  clearConversation(): void;
  setSpeaker(speaker: 'interviewer' | 'interviewee'): void;
}

export class ConversationManager extends EventEmitter implements IConversationManager {
  private messages: ConversationMessage[] = [];
  private currentSpeaker: 'interviewer' | 'interviewee' = 'interviewee';

  /**
   * Adds a new message to the conversation
   * @param text - Message text
   * @param speaker - Optional speaker override, uses current speaker if not provided
   * @returns The created message
   */
  public addMessage(
    text: string, 
    speaker?: 'interviewer' | 'interviewee'
  ): ConversationMessage {
    if (!text || text.trim().length === 0) {
      throw new Error('Message text cannot be empty');
    }

    const message: ConversationMessage = {
      id: this.generateMessageId(),
      speaker: speaker || this.currentSpeaker,
      text: text.trim(),
      timestamp: Date.now(),
    };

    this.messages.push(message);
    this.emit('message-added', message);
    return message;
  }

  /**
   * Toggles between interviewer and interviewee speaker modes
   * @returns The new speaker mode
   */
  public toggleSpeaker(): 'interviewer' | 'interviewee' {
    this.currentSpeaker = this.currentSpeaker === 'interviewer' 
      ? 'interviewee' 
      : 'interviewer';
    this.emit('speaker-changed', this.currentSpeaker);
    return this.currentSpeaker;
  }

  /**
   * Sets the current speaker mode
   * @param speaker - Speaker mode to set
   */
  public setSpeaker(speaker: 'interviewer' | 'interviewee'): void {
    if (this.currentSpeaker !== speaker) {
      this.currentSpeaker = speaker;
      this.emit('speaker-changed', this.currentSpeaker);
    }
  }

  /**
   * Gets the current speaker mode
   */
  public getCurrentSpeaker(): 'interviewer' | 'interviewee' {
    return this.currentSpeaker;
  }

  /**
   * Gets all messages in the conversation
   * @returns Copy of messages array (immutable)
   */
  public getMessages(): ConversationMessage[] {
    return [...this.messages];
  }

  /**
   * Gets conversation history as formatted string
   * @returns Formatted conversation history
   */
  public getConversationHistory(): string {
    return this.messages
      .map(msg => `[${msg.speaker === 'interviewer' ? 'Interviewer' : 'You'}] ${msg.text}`)
      .join('\n\n');
  }

  /**
   * Gets all answers from the interviewee
   * @returns Array of interviewee answer texts
   */
  public getIntervieweeAnswers(): string[] {
    return this.messages
      .filter(msg => msg.speaker === 'interviewee')
      .map(msg => msg.text);
  }

  /**
   * Updates an existing message
   * @param messageId - ID of message to update
   * @param newText - New text for the message
   * @returns True if message was found and updated, false otherwise
   */
  public updateMessage(messageId: string, newText: string): boolean {
    if (!newText || newText.trim().length === 0) {
      return false;
    }

    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      message.text = newText.trim();
      message.edited = true;
      this.emit('message-updated', message);
      return true;
    }
    return false;
  }

  /**
   * Clears all messages and resets to default speaker
   */
  public clearConversation(): void {
    this.messages = [];
    this.currentSpeaker = 'interviewee';
    this.emit('conversation-cleared');
  }

  /**
   * Generates a unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
