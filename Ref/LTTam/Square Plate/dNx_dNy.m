function [dNdx,dNdy]=dNx_dNy(nnel,dNdxi,dNdeta,invjacob)

%------------------------------------------------------------------------
%  Purpose:
%     determine derivatives of 2-D isoparametric shape functions with 
%     respect to physical coordinate system
%
%  Synopsis:
%     [dNdx,dNdy]=federiv2(nnel,dNdxi,dNdeta,invjacob)  
%
%  Variable Description:
%     dNdx - derivative of shape function w.r.t. physical coordinate x
%     dNdy - derivative of shape function w.r.t. physical coordinate y
%     nnel - number of nodes per element   
%     dNdxi - derivative of shape functions w.r.t. natural coordinate r
%     dNdeta - derivative of shape functions w.r.t. natural coordinate s
%     invjacob - inverse of 2-D Jacobian matrix
%------------------------------------------------------------------------

 for i=1:nnel
 dNdx(i)=invjacob(1,1)*dNdxi(i)+invjacob(1,2)*dNdeta(i);
 dNdy(i)=invjacob(2,1)*dNdxi(i)+invjacob(2,2)*dNdeta(i);
 end
