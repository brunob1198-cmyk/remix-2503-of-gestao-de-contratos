I will update the `extract-contract` Edge Function to use a valid model name and implement the requested fallback mechanism.

### Technical Details

1. **Update Model Name**: The logs indicate `gemini-2.0-flash` is currently invalid in the AI Gateway environment. I will use `google/gemini-2.5-flash` as suggested by the error message's allowed models list (or `google/gemini-2.0-flash` if I can verify it works, but I'll stick to what the log explicitly allowed).
2. **Implement Fallback Logic**:
   - I'll create a function to encapsulate the AI Gateway call.
   - If the first attempt (e.g., as `image_url`) fails with a 400 error, the code will retry with the document structured as a `file`.
   - I will also ensure that `file_data` for the `file` type can be either a URL or a base64 string.
3. **Handle R2 URLs**: Ensure the logic correctly identifies R2 URLs and passes them to the AI Gateway.
4. **Improved Error Handling**: Better logging of why an attempt failed and what the fallback is doing.

### Steps

- Modify `supabase/functions/extract-contract/index.ts` to include the fallback logic and update the model name.
- Deploy the updated Edge Function.
- Verify the logs after deployment.
