-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN address2 text,
ADD COLUMN city text;

-- Set existing users' city to 'Hillsboro'
UPDATE public.profiles SET city = 'Hillsboro' WHERE city IS NULL;

-- Update the handle_new_user function to include all profile fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    first_name, 
    last_name, 
    phone, 
    address, 
    address2,
    city,
    state, 
    zip
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'address',
    new.raw_user_meta_data ->> 'address2',
    new.raw_user_meta_data ->> 'city',
    new.raw_user_meta_data ->> 'state',
    new.raw_user_meta_data ->> 'zip'
  );
  RETURN new;
END;
$$;