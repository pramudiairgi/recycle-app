export const load = async ({ url }: { url: URL }) => {
	return { activePath: url.pathname };
};
