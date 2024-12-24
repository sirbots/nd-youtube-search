/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '2rem',
				sm: '2rem',
				md: '2rem',
				lg: '3rem',
				xl: '6rem',
				'2xl': '8rem'
			},
			// padding: '3rem',
			screens: {
				/*

					Breakpoint prefix	Minimum width	CSS
					sm					640px			@media (min-width: 640px) { ... }
					md					768px			@media (min-width: 768px) { ... }
					lg					1024px			@media (min-width: 1024px) { ... }
					xl					1280px			@media (min-width: 1280px) { ... }
					2xl					1536px			@media (min-width: 1536px) { ... }

				*/
				sm: '640px', // defaults to 640px when not set explicitly
				md: '768px',
				lg: '1024px',
				xl: '1280px',
				'2xl': '1536px'
			}
		},

		extend: {}
	},
	plugins: []
};
