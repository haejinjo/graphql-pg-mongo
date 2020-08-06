DROP TABLE public.dogs;

CREATE TABLE public.dogs
(
  "id" serial UNIQUE NOT NULL,
  "name" varchar NOT NULL,
  "breed" varchar (60) NOT NULL,
  "walkerId" varchar,
  CONSTRAINT "dogs_pk" PRIMARY KEY ("id")
)
WITH (
  OIDS=FALSE
);

-- INSERT INTO public.dogs
-- VALUES(1, 'Ponzu', 'Pomeranian');
-- INSERT INTO public.dogs
-- VALUES(2, 'Miki', 'Labrador Retriever');
-- INSERT INTO public.dogs
-- VALUES(3, 'Jetta', 'Mixed/Mutt');
-- INSERT INTO public.dogs
-- VALUES(4, 'Shrek', 'French Bulldog');
-- INSERT INTO public.dogs
-- VALUES(5, 'Kermit', 'Italian Greyhound');