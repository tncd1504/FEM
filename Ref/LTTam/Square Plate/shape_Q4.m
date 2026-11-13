function [shapeq4,dNdxi,dNdeta]=shape_Q4(rvalue,svalue,al)

%------------------------------------------------------------------------
%  Purpose:
%     compute isoparametric four-node quadilateral shape functions
%     and their derivatves at the selected (integration) point
%     in terms of the natural coordinate 
%
%  Synopsis:
%     [shapeq4,dNdxi,dNdeta]=feisoq4(rvalue,svalue)  
%
%  Variable Description:
%     shapeq4 - shape functions for four-node element
%     dNdxi - derivatives of the shape functions w.r.t. r
%     dNdeta - derivatives of the shape functions w.r.t. s
%     rvalue - r coordinate value of the selected point   
%     svalue - s coordinate value of the selected point
%
%  Notes:
%     1st node at (-1,-1), 2nd node at (1,-1)
%     3rd node at (1,1), 4th node at (-1,1)
%------------------------------------------------------------------------

% shape functions

 shapeq4(1)=0.25*(1-rvalue)*(1-svalue);
 shapeq4(2)=0.25*(1+rvalue)*(1-svalue);
 shapeq4(3)=0.25*(1+rvalue)*(1+svalue);
 shapeq4(4)=0.25*(1-rvalue)*(1+svalue);

% derivatives
%Rank=9 (1.438x10^-5 -> 1.438x10^-5),
%Rank=7 (7.10^-8 -> 1.438x10^-5), 
%Rank=6 (7.10^-8 -> 3.5x10^-6), 
%Rank=5 (3.6 x 10^-6 ->6.10^-8)
%al=0.000019136798989867197340;
%al=0.00001;
%al=0.0001;

 dNdxi(1)=-0.25*(1-al*svalue);
 dNdxi(2)=0.25*(1-al*svalue);
 dNdxi(3)=0.25*(1+al*svalue);
 dNdxi(4)=-0.25*(1+al*svalue);

 dNdeta(1)=-0.25*(1-al*rvalue);
 dNdeta(2)=-0.25*(1+al*rvalue);
 dNdeta(3)=0.25*(1+al*rvalue);
 dNdeta(4)=0.25*(1-al*rvalue);
