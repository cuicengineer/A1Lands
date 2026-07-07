import ProductListPage from "layouts/products/shared/ProductListPage";
import { productServiceApi } from "services/api.product.service";

export default function Services() {
  return (
    <ProductListPage
      title="Services"
      subtitle="Manage service products"
      mode="service"
      api={productServiceApi}
      exportFileName="Product-Services"
    />
  );
}
