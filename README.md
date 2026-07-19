BookFlix is a Netflix-style Book Recommendation System that features a beautiful, interactive user interface paired with a machine learning backend to provide personalized book recommendations to users.

The project is split into two main architectures: the Backend (Brain) and the Frontend (Face).

1. The Backend (Python & FastAPI)
The backend serves as the brain of the application, handling API requests, processing data, and running the machine learning models.

Key Components:

FastAPI Server (app/main.py): Handles all API requests coming from the website, such as searching for books or asking for recommendations.
Machine Learning Engine (app/ml/recommender.py): Uses the K-Nearest Neighbors (KNN) algorithm to determine which books to recommend.
Data Generation Tools: Scripts (generate_data.py & prepare_data.py) used to create mock users, ratings, and prepare the book data for the ML model to learn from.
2. The Frontend (Next.js & React)
The frontend serves as the face of the application, providing users with a smooth, Netflix-like browsing experience.

Key Components:

Profile Selection (src/app/page.tsx): A "Who is reading today?" splash screen that appears when the app opens.
Browse Dashboard (src/app/browse/page.tsx): The main scrolling page featuring a Hero Banner and horizontal carousels categorized by themes like "Trending Now" and "Popular Series".
Interactive UI Elements:
BookCard: Individual book covers users can click on in a carousel.
BookDetailModal: A detailed pop-up window showing "AI Insights" and a "More Like This" recommendation carousel.
State Management (src/store/useStore.ts): Acts as the memory for the website to remember which user is logged in and what books are saved to "My List".
3. How the Recommendation Algorithm Works
The core of the recommendation engine relies on a specific variation of KNN called Item-Based Collaborative Filtering.

The Data Matrix: Behind the scenes, the system creates a massive grid where rows are Books, columns are Users, and the intersecting numbers are the Ratings (1 to 10) those users gave to the books.
Plotting in Space: Books are treated as points on a massive multi-dimensional graph. Books rated similarly by the exact same users are plotted physically closer together.
Finding Nearest Neighbors: When a user selects a book (e.g., Harry Potter), the algorithm looks at its location on the graph and finds the "K" (e.g., 5) books closest to it using a mathematical formula called Cosine Similarity.
Delivering the Recommendation: The physically closest books (e.g., Percy Jackson) are sent to the frontend and displayed in the "More Like This" carousel.
