function [matmtrx]=material_shear(emodule,poisson,shcof,t)

%------------------------------------------------------------------------
%  Purpose:
%     determine the constitutive equation for isotropic material
%
%  Synopsis:
%     [matmtrx]=material_shear(elastic,poisson,shcof)
%
%  Variable Description:
%     emodule - elastic modulus
%     poisson - Poisson's ratio   
%     shcof   - coefficient correction shear
%------------------------------------------------------------------------
shearm=0.5*emodule/(1.0+poisson);
matmtrx=shearm*shcof*t*[1 0; 0 1]; 
 
