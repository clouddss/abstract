import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tokensService } from '@/lib/api/services/tokens.service'
import { 
  CreateTokenRequest,
  CreateTokenResponse
} from '@/lib/api/types/token.types'
import { useRouter } from 'next/navigation'

// Hook for creating a new token
export function useCreateToken() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation<CreateTokenResponse, Error, CreateTokenRequest>({
    mutationFn: (data) => tokensService.createToken(data),
    onSuccess: (response) => {
      // Invalidate tokens list to include the new token
      queryClient.invalidateQueries({ 
        queryKey: ['tokens'] 
      })
      
      // Invalidate recent tokens
      queryClient.invalidateQueries({ 
        queryKey: ['tokens', 'recent'] 
      })
      
      // Invalidate creator's tokens if creator address is available
      if (response.token.creator) {
        queryClient.invalidateQueries({ 
          queryKey: ['tokens', 'creator', response.token.creator] 
        })
      }
      
      // Prefetch the new token details
      queryClient.prefetchQuery({
        queryKey: ['token', response.token.address],
        queryFn: () => tokensService.getTokenDetails(response.token.address),
        staleTime: 1000 * 60 * 2, // 2 minutes
      })
      
      // Navigate to the token page
      router.push(`/token/${response.token.address}`)
    },
    retry: 1,
  })
}

// Hook for validating token creation data before submission
export function useValidateTokenCreation() {
  return (data: Partial<CreateTokenRequest>): { 
    isValid: boolean; 
    errors: Record<string, string> 
  } => {
    const errors: Record<string, string> = {}
    
    // Name validation
    if (!data.name || data.name.trim().length === 0) {
      errors.name = 'Token name is required'
    } else if (data.name.length > 50) {
      errors.name = 'Token name must be 50 characters or less'
    }
    
    // Symbol validation
    if (!data.symbol || data.symbol.trim().length === 0) {
      errors.symbol = 'Token symbol is required'
    } else if (data.symbol.length > 10) {
      errors.symbol = 'Token symbol must be 10 characters or less'
    } else if (!/^[A-Z0-9]+$/i.test(data.symbol)) {
      errors.symbol = 'Token symbol must contain only letters and numbers'
    }
    
    // Description validation (optional)
    if (data.description && data.description.length > 500) {
      errors.description = 'Description must be 500 characters or less'
    }
    
    // URL validations (optional)
    const urlPattern = /^https?:\/\/.+\..+/
    
    if (data.website && !urlPattern.test(data.website)) {
      errors.website = 'Website must be a valid URL'
    }
    
    if (data.twitter && !data.twitter.match(/^https?:\/\/(www\.)?twitter\.com\/.+/)) {
      errors.twitter = 'Twitter must be a valid Twitter URL'
    }
    
    if (data.telegram && !data.telegram.match(/^https?:\/\/(www\.|t\.)?telegram\.(org|me)\/.+/)) {
      errors.telegram = 'Telegram must be a valid Telegram URL'
    }
    
    // Initial buy validation
    if (data.initialBuyEth) {
      const buyAmount = parseFloat(data.initialBuyEth)
      if (isNaN(buyAmount) || buyAmount < 0) {
        errors.initialBuyEth = 'Initial buy must be a positive number'
      } else if (buyAmount > 10) {
        errors.initialBuyEth = 'Initial buy cannot exceed 10 ETH'
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  }
}