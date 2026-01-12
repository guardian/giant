export function calculateResourceTitle(resource) {
  const postfix = "Giant";

  if (resource) {
    if (resource.type === "email" && resource.subject) {
      return `${resource.subject} - ${postfix}`;
    }

    const parts = (resource.display || decodeURIComponent(resource.uri)).split(
      "/",
    );

    const isResource = parts.length > 1;
    const isBlob = !isResource && resource.parents.length > 0;

    if (isResource) {
      return `${parts[parts.length - 1]} - ${postfix}`;
    } else if (isBlob) {
      // Render parent resource name if viewing a blob.
      // For user-uploaded files this will be the filename they uploaded with.
      const parts = resource.parents[0].uri.split("/");

      if (parts.length > 1) {
        return `${decodeURIComponent(parts[parts.length - 1])} - ${postfix}`;
      }
    }
  }

  return postfix;
}

export function calculateSearchTitle(search) {
  if (search && search.q) {
    try {
      const parts = JSON.parse(search.q).map((part) => {
        if (part.n) {
          if (part.op === "-") {
            return `-${part.n}: ${part.v}`;
          }

          return `${part.n}: ${part.v}`;
        }

        return part;
      });

      if (parts.length > 0 && !(parts.length === 1 && parts[0] === "")) {
        return `${parts.join(" ")} - Search - Giant`;
      }
    } catch {
      // We don't understand the format
    }
  }

  return "Search - Giant";
}
