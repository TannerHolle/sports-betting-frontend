<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Submit a Suggestion</h2>
        <button class="close-btn" @click="closeModal" aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <p class="modal-description">
          Think you've got a great idea? Prove it. I want to hear your suggestions. Worst case scenario? I politely ignore you. Best case? You help make this app better.
        </p>
        
        <div class="form-group">
          <label for="suggestion-text">Your Suggestion</label>
          <textarea
            id="suggestion-text"
            v-model="suggestionText"
            placeholder="Tell us what you'd like to see improved or added..."
            rows="6"
            class="suggestion-input"
            :disabled="isSubmitting"
          ></textarea>
          <div class="char-count">{{ suggestionText.length }}/1000</div>
        </div>
        
        <div v-if="message" class="message" :class="message.type">
          {{ message.text }}
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary" :disabled="isSubmitting">
          Cancel
        </button>
        <button @click="submitSuggestion" class="btn btn-primary" :disabled="isSubmitting || !canSubmit">
          {{ isSubmitting ? 'Submitting...' : 'Submit Suggestion' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'SuggestionsModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const userStore = useUserStore()
    const suggestionText = ref('')
    const isSubmitting = ref(false)
    const message = ref(null)
    
    const currentUser = computed(() => userStore.currentUser.value)
    
    const canSubmit = computed(() => {
      return suggestionText.value.trim().length > 0 && 
             suggestionText.value.trim().length <= 1000 &&
             !isSubmitting.value
    })
    
    const closeModal = () => {
      if (!isSubmitting.value) {
        suggestionText.value = ''
        message.value = null
        emit('close')
      }
    }
    
    const submitSuggestion = async () => {
      if (!canSubmit.value) return
      
      isSubmitting.value = true
      message.value = null
      
      try {
        const response = await axios.post(`${API_BASE_URL}/suggestions`, {
          username: currentUser.value.username,
          suggestion: suggestionText.value.trim()
        })
        
        if (response.data.success) {
          message.value = {
            type: 'success',
            text: '✅ Thank you! Your suggestion has been submitted successfully.'
          }
          
          // Clear form and close after a delay
          setTimeout(() => {
            suggestionText.value = ''
            message.value = null
            emit('close')
          }, 2000)
        }
      } catch (error) {
        console.error('Error submitting suggestion:', error)
        message.value = {
          type: 'error',
          text: '❌ Failed to submit suggestion. Please try again.'
        }
      } finally {
        isSubmitting.value = false
      }
    }
    
    // Watch for suggestion text length
    watch(suggestionText, (newVal) => {
      if (newVal.length > 1000) {
        suggestionText.value = newVal.substring(0, 1000)
      }
    })
    
    return {
      suggestionText,
      isSubmitting,
      message,
      currentUser,
      canSubmit,
      closeModal,
      submitSuggestion
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f3f4f6;
  color: var(--color-text);
}

.modal-body {
  padding: 2rem;
  flex: 1;
  overflow-y: auto;
}

.modal-description {
  margin: 0 0 1.5rem 0;
  color: var(--color-text-muted);
  font-size: var(--text-base);
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
  font-size: var(--text-sm);
}

.suggestion-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.suggestion-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.suggestion-input:disabled {
  background: var(--color-surface-muted);
  cursor: not-allowed;
}

.char-count {
  text-align: right;
  margin-top: 0.25rem;
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.message {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  margin-top: 1rem;
}

.message.success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-border);
}

.btn-primary {
  background: var(--gradient-brand);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 85vh;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1.25rem;
  }
  
  .modal-header h2 {
    font-size: var(--text-xl);
  }
}
</style>

