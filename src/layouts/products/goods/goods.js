import ProductListPage from "layouts/products/shared/ProductListPage";
import { productGoodApi } from "services/api.product.service";

export default function Goods() {
  return (
    <ProductListPage
      title="Goods"
      subtitle="Manage goods / inventory products"
      mode="good"
      api={productGoodApi}
      exportFileName="Product-Goods"
    />
  );
}
